import { createHash } from "node:crypto";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { minify } from "terser";
import { parseProgram } from "./semantic-rewriter.js";
import { round2Artifacts } from "./fetch-round2-artifacts.js";

const benchmarkDir = "benchmarks/round2";
const windowsPath = "benchmarks/round6/windows.json";
const candidatePath = "benchmarks/round6/llm-candidates.json";
const round3Path = "results/round3.json";
const resultsDir = "results";
const selectedArtifacts = new Map(round2Artifacts.map((artifact) => [artifact.name, artifact]));

function byteSize(code) {
  return Buffer.byteLength(code, "utf8");
}

function gzipSize(code) {
  return gzipSync(Buffer.from(code)).byteLength;
}

function brotliSize(code) {
  return brotliCompressSync(Buffer.from(code)).byteLength;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function terserMinify(code) {
  const result = await minify(code, {
    compress: true,
    mangle: true,
    module: false,
    format: { comments: false },
  });
  if (!result.code) throw new Error("Terser produced empty output");
  return result.code;
}

function validatesSyntax(code) {
  try {
    parseProgram(code);
    return true;
  } catch {
    return false;
  }
}

async function loadArtifact(artifactName, cache) {
  if (!cache.has(artifactName)) {
    cache.set(artifactName, await readFile(join(benchmarkDir, `${artifactName}.js`), "utf8"));
  }
  return cache.get(artifactName);
}

async function loadTerserBaseline(artifactName, original, cache) {
  if (!cache.has(artifactName)) {
    const code = await terserMinify(original);
    cache.set(artifactName, {
      source: "terser",
      name: "terser",
      bytes: byteSize(code),
      gzipBytes: gzipSize(code),
      brotliBytes: brotliSize(code),
    });
  }
  return cache.get(artifactName);
}

function round3Candidate(rows, artifact) {
  const row = rows.find((candidate) => candidate.benchmark === artifact);
  if (!row) throw new Error(`Missing Round 3 row for ${artifact}`);
  return {
    source: "round3",
    name: row.bestSemanticRule,
    bytes: row.bestSemanticBytes,
    gzipBytes: row.bestSemanticGzipBytes,
    brotliBytes: row.bestSemanticBrotliBytes,
  };
}

function pickBestByBrotli(candidates) {
  return candidates.reduce((best, candidate) => {
    if (candidate.brotliBytes !== best.brotliBytes) return candidate.brotliBytes < best.brotliBytes ? candidate : best;
    if (candidate.gzipBytes !== best.gzipBytes) return candidate.gzipBytes < best.gzipBytes ? candidate : best;
    return candidate.bytes < best.bytes ? candidate : best;
  });
}

function spliceCandidate(original, window, response) {
  const sourceWindow = original.slice(window.start, window.end);
  if (sha256(sourceWindow) !== window.sourceSha256) {
    throw new Error("source window hash mismatch");
  }
  return `${original.slice(0, window.start)}${response.code}${original.slice(window.end)}`;
}

async function evaluateWindowResponse(window, response, original, terserBaseline) {
  const sourceWindow = original.slice(window.start, window.end);
  if (sha256(sourceWindow) !== window.sourceSha256) {
    throw new Error("source window hash mismatch");
  }

  if (response.code === sourceWindow) {
    return {
      source: "llm-window",
      name: `${window.id}:${response.name}`,
      windowId: window.id,
      responseKind: response.kind ?? "cached",
      bytes: terserBaseline.bytes,
      gzipBytes: terserBaseline.gzipBytes,
      brotliBytes: terserBaseline.brotliBytes,
      reusedBaseline: true,
    };
  }

  const minified = await terserMinify(spliceCandidate(original, window, response));
  if (!validatesSyntax(minified)) {
    throw new Error("minified output failed syntax validation");
  }
  return {
    source: "llm-window",
    name: `${window.id}:${response.name}`,
    windowId: window.id,
    responseKind: response.kind ?? "cached",
    bytes: byteSize(minified),
    gzipBytes: gzipSize(minified),
    brotliBytes: brotliSize(minified),
    reusedBaseline: false,
  };
}

async function runArtifact(artifact, windows, responsesByWindow, round3Rows, artifactCache, baselineCache) {
  const start = performance.now();
  const original = await loadArtifact(artifact, artifactCache);
  const terserBaseline = await loadTerserBaseline(artifact, original, baselineCache);
  const deterministic = round3Candidate(round3Rows, artifact);
  const llmCandidates = [];
  const rejected = [];
  let modelCandidates = 0;

  for (const window of windows) {
    for (const response of responsesByWindow.get(window.id) ?? []) {
      modelCandidates += 1;
      try {
        llmCandidates.push(await evaluateWindowResponse(window, response, original, terserBaseline));
      } catch (error) {
        rejected.push({
          windowId: window.id,
          name: response.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const bestLlm = llmCandidates.length > 0 ? pickBestByBrotli(llmCandidates) : null;
  const bestHybrid = pickBestByBrotli([terserBaseline, deterministic, ...llmCandidates]);
  const artifactInfo = selectedArtifacts.get(artifact);
  return {
    benchmark: artifact,
    version: artifactInfo?.version ?? "unknown",
    windows: windows.length,
    modelCandidates,
    syntaxValidCandidates: llmCandidates.length,
    rejectedCandidates: rejected.length,
    round3Rule: deterministic.name,
    bestLlmCandidate: bestLlm?.name ?? "none",
    bestLlmDeltaBrotliVsTerser: bestLlm ? bestLlm.brotliBytes - terserBaseline.brotliBytes : 0,
    bestHybridSource: bestHybrid.source,
    bestHybridCandidate: bestHybrid.name,
    beatsTerserBrotli: bestHybrid.brotliBytes < terserBaseline.brotliBytes,
    beatsRound3Brotli: bestHybrid.brotliBytes < deterministic.brotliBytes,
    terserBytes: terserBaseline.bytes,
    round3Bytes: deterministic.bytes,
    bestHybridBytes: bestHybrid.bytes,
    deltaBytesVsTerser: bestHybrid.bytes - terserBaseline.bytes,
    deltaBytesVsRound3: bestHybrid.bytes - deterministic.bytes,
    terserGzipBytes: terserBaseline.gzipBytes,
    round3GzipBytes: deterministic.gzipBytes,
    bestHybridGzipBytes: bestHybrid.gzipBytes,
    deltaGzipVsTerser: bestHybrid.gzipBytes - terserBaseline.gzipBytes,
    deltaGzipVsRound3: bestHybrid.gzipBytes - deterministic.gzipBytes,
    terserBrotliBytes: terserBaseline.brotliBytes,
    round3BrotliBytes: deterministic.brotliBytes,
    bestHybridBrotliBytes: bestHybrid.brotliBytes,
    deltaBrotliVsTerser: bestHybrid.brotliBytes - terserBaseline.brotliBytes,
    deltaBrotliVsRound3: bestHybrid.brotliBytes - deterministic.brotliBytes,
    rejected,
    latencyMs: Number((performance.now() - start).toFixed(2)),
  };
}

function summarize(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.artifacts += 1;
      summary.windows += row.windows;
      summary.modelCandidates += row.modelCandidates;
      summary.syntaxValidCandidates += row.syntaxValidCandidates;
      summary.rejectedCandidates += row.rejectedCandidates;
      summary.beatsTerserBrotli += row.beatsTerserBrotli ? 1 : 0;
      summary.beatsRound3Brotli += row.beatsRound3Brotli ? 1 : 0;
      summary.deltaBytesVsTerser += row.deltaBytesVsTerser;
      summary.deltaGzipVsTerser += row.deltaGzipVsTerser;
      summary.deltaBrotliVsTerser += row.deltaBrotliVsTerser;
      summary.deltaBytesVsRound3 += row.deltaBytesVsRound3;
      summary.deltaGzipVsRound3 += row.deltaGzipVsRound3;
      summary.deltaBrotliVsRound3 += row.deltaBrotliVsRound3;
      return summary;
    },
    {
      artifacts: 0,
      windows: 0,
      modelCandidates: 0,
      syntaxValidCandidates: 0,
      rejectedCandidates: 0,
      beatsTerserBrotli: 0,
      beatsRound3Brotli: 0,
      deltaBytesVsTerser: 0,
      deltaGzipVsTerser: 0,
      deltaBrotliVsTerser: 0,
      deltaBytesVsRound3: 0,
      deltaGzipVsRound3: 0,
      deltaBrotliVsRound3: 0,
    },
  );
}

function toMarkdown(payload, candidateSet) {
  const headers = [
    "benchmark",
    "version",
    "windows",
    "modelCandidates",
    "syntaxValidCandidates",
    "round3Rule",
    "bestLlmCandidate",
    "bestLlmDeltaBrotliVsTerser",
    "bestHybridSource",
    "bestHybridCandidate",
    "beatsTerserBrotli",
    "beatsRound3Brotli",
    "deltaBytesVsTerser",
    "deltaGzipVsTerser",
    "deltaBrotliVsTerser",
    "deltaBytesVsRound3",
    "deltaGzipVsRound3",
    "deltaBrotliVsRound3",
  ];
  const lines = [
    "# Round 6 Results",
    "",
    "Corpus: five deterministically selected source windows from each pinned Round 2 artifact.",
    "",
    `Windows: ${windowsPath}`,
    `Candidate source: ${candidatePath}`,
    `Candidate generation mode: ${candidateSet.generationMode}`,
    `Candidate model: ${candidateSet.model}`,
    "",
    "Execution mode: hybrid Brotli-first selection among Terser, Round 3 deterministic semantic output, and cached LLM-window candidates.",
    "",
    "Validation note: LLM-window candidates validate source-window hash, Terser minifiability, and post-minify syntax. Round 3 metrics are imported from `results/round3.json`.",
    "",
    `Generated at ${payload.generatedAt}.`,
    "",
    "## Summary",
    "",
    `- Artifacts: ${payload.summary.artifacts}`,
    `- Windows: ${payload.summary.windows}`,
    `- Model candidates: ${payload.summary.modelCandidates}`,
    `- Syntax-valid model candidates: ${payload.summary.syntaxValidCandidates}`,
    `- Rejected model candidates: ${payload.summary.rejectedCandidates}`,
    `- Beat Terser by Brotli: ${payload.summary.beatsTerserBrotli}`,
    `- Beat Round 3 by Brotli: ${payload.summary.beatsRound3Brotli}`,
    `- Aggregate delta vs Terser: raw ${payload.summary.deltaBytesVsTerser}, gzip ${payload.summary.deltaGzipVsTerser}, Brotli ${payload.summary.deltaBrotliVsTerser}`,
    `- Aggregate delta vs Round 3: raw ${payload.summary.deltaBytesVsRound3}, gzip ${payload.summary.deltaGzipVsRound3}, Brotli ${payload.summary.deltaBrotliVsRound3}`,
    "",
    "## Hybrid Comparison",
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  for (const row of payload.rows) {
    lines.push(`| ${headers.map((header) => row[header]).join(" | ")} |`);
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const windowsPayload = JSON.parse(await readFile(windowsPath, "utf8"));
  const candidateSet = JSON.parse(await readFile(candidatePath, "utf8"));
  const round3Rows = JSON.parse(await readFile(round3Path, "utf8"));
  const responsesByWindow = new Map(candidateSet.candidates.map((entry) => [entry.windowId, entry.responses ?? []]));
  const windowsByArtifact = Map.groupBy(windowsPayload.windows, (window) => window.artifact);
  const artifactCache = new Map();
  const baselineCache = new Map();
  const rows = [];

  for (const artifact of [...windowsByArtifact.keys()].sort()) {
    rows.push(await runArtifact(artifact, windowsByArtifact.get(artifact), responsesByWindow, round3Rows, artifactCache, baselineCache));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    windowsPath,
    candidatePath,
    candidateGenerationMode: candidateSet.generationMode,
    candidateModel: candidateSet.model,
    summary: summarize(rows),
    rows,
  };

  await mkdir(resultsDir, { recursive: true });
  await writeFile(join(resultsDir, "round6.json"), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(join(resultsDir, "round6.md"), toMarkdown(payload, candidateSet));

  console.table(
    rows.map((row) => ({
      benchmark: row.benchmark,
      bestHybridSource: row.bestHybridSource,
      bestHybridCandidate: row.bestHybridCandidate,
      beatsRound3Brotli: row.beatsRound3Brotli,
      deltaBrotliVsTerser: row.deltaBrotliVsTerser,
      deltaBrotliVsRound3: row.deltaBrotliVsRound3,
    })),
  );
  console.log(`\nWrote ${join(resultsDir, "round6.json")} and ${join(resultsDir, "round6.md")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
