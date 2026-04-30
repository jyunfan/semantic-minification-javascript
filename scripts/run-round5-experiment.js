import { createHash } from "node:crypto";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { minify } from "terser";
import { parseProgram } from "./semantic-rewriter.js";
import { round2Artifacts } from "./fetch-round2-artifacts.js";

const benchmarkDir = "benchmarks/round2";
const windowsPath = "benchmarks/round5/windows.json";
const candidatePath = "benchmarks/round5/llm-candidates.json";
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
      name: "terser",
      code,
      bytes: byteSize(code),
      gzipBytes: gzipSize(code),
      brotliBytes: brotliSize(code),
    });
  }
  return cache.get(artifactName);
}

function spliceCandidate(original, window, response) {
  const sourceWindow = original.slice(window.start, window.end);
  if (sha256(sourceWindow) !== window.sourceSha256) {
    throw new Error("source window hash mismatch");
  }
  return `${original.slice(0, window.start)}${response.code}${original.slice(window.end)}`;
}

function pickBestByBrotli(baseline, candidates) {
  return candidates.reduce((best, candidate) => {
    if (candidate.brotliBytes !== best.brotliBytes) return candidate.brotliBytes < best.brotliBytes ? candidate : best;
    if (candidate.gzipBytes !== best.gzipBytes) return candidate.gzipBytes < best.gzipBytes ? candidate : best;
    return candidate.bytes < best.bytes ? candidate : best;
  }, baseline);
}

function round3ForArtifact(rows, artifact) {
  const row = rows.find((candidate) => candidate.benchmark === artifact);
  if (!row) throw new Error(`Missing Round 3 row for ${artifact}`);
  return {
    bytes: row.bestSemanticBytes,
    gzipBytes: row.bestSemanticGzipBytes,
    brotliBytes: row.bestSemanticBrotliBytes,
    rule: row.bestSemanticRule,
  };
}

async function runWindow(window, responses, round3Rows, artifactCache, baselineCache) {
  const start = performance.now();
  const original = await loadArtifact(window.artifact, artifactCache);
  const terserBaseline = await loadTerserBaseline(window.artifact, original, baselineCache);
  const round3 = round3ForArtifact(round3Rows, window.artifact);
  const verified = [];
  const rejected = [];

  for (const response of responses) {
    try {
      const candidateCode = spliceCandidate(original, window, response);
      const minified = await terserMinify(candidateCode);
      if (!validatesSyntax(minified)) {
        rejected.push({ name: response.name, error: "minified output failed syntax validation" });
        continue;
      }
      verified.push({
        name: response.name,
        bytes: byteSize(minified),
        gzipBytes: gzipSize(minified),
        brotliBytes: brotliSize(minified),
      });
    } catch (error) {
      rejected.push({
        name: response.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const best = pickBestByBrotli(terserBaseline, verified);
  const artifact = selectedArtifacts.get(window.artifact);
  return {
    id: window.id,
    benchmark: window.artifact,
    version: artifact?.version ?? "unknown",
    windowScore: window.score,
    sourceWindowBytes: window.sourceWindowBytes,
    features: window.features.join("+"),
    modelCandidates: responses.length,
    syntaxValidCandidates: verified.length,
    rejectedCandidates: rejected.length,
    round3Rule: round3.rule,
    bestCandidate: best.name,
    acceptedByBrotliVsTerser: best.name !== "terser" && best.brotliBytes < terserBaseline.brotliBytes,
    beatsRound3Brotli: best.brotliBytes < round3.brotliBytes,
    terserBytes: terserBaseline.bytes,
    round3Bytes: round3.bytes,
    bestBytes: best.bytes,
    deltaBytesVsTerser: best.bytes - terserBaseline.bytes,
    deltaBytesVsRound3: best.bytes - round3.bytes,
    terserGzipBytes: terserBaseline.gzipBytes,
    round3GzipBytes: round3.gzipBytes,
    bestGzipBytes: best.gzipBytes,
    deltaGzipVsTerser: best.gzipBytes - terserBaseline.gzipBytes,
    deltaGzipVsRound3: best.gzipBytes - round3.gzipBytes,
    terserBrotliBytes: terserBaseline.brotliBytes,
    round3BrotliBytes: round3.brotliBytes,
    bestBrotliBytes: best.brotliBytes,
    deltaBrotliVsTerser: best.brotliBytes - terserBaseline.brotliBytes,
    deltaBrotliVsRound3: best.brotliBytes - round3.brotliBytes,
    rejected,
    latencyMs: Number((performance.now() - start).toFixed(2)),
  };
}

function summarize(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.artifacts += 1;
      summary.modelCandidates += row.modelCandidates;
      summary.syntaxValidCandidates += row.syntaxValidCandidates;
      summary.acceptedByBrotliVsTerser += row.acceptedByBrotliVsTerser ? 1 : 0;
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
      modelCandidates: 0,
      syntaxValidCandidates: 0,
      acceptedByBrotliVsTerser: 0,
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
    "windowScore",
    "sourceWindowBytes",
    "features",
    "round3Rule",
    "bestCandidate",
    "acceptedByBrotliVsTerser",
    "beatsRound3Brotli",
    "deltaBytesVsTerser",
    "deltaGzipVsTerser",
    "deltaBrotliVsTerser",
    "deltaBytesVsRound3",
    "deltaGzipVsRound3",
    "deltaBrotliVsRound3",
  ];
  const lines = [
    "# Round 5 Results",
    "",
    "Corpus: one deterministically selected source window from each pinned Round 2 artifact.",
    "",
    `Windows: ${windowsPath}`,
    `Candidate source: ${candidatePath}`,
    `Candidate generation mode: ${candidateSet.generationMode}`,
    `Candidate model: ${candidateSet.model}`,
    "",
    "Execution mode: cached LLM-generated window rewrites; each response is spliced into the original artifact, minified by Terser, syntax-checked, scored by Brotli first, then compared with Round 3.",
    "",
    "Validation note: this round validates source-window hash, Terser minifiability, and post-minify syntax. It does not run upstream behavioral tests.",
    "",
    `Generated at ${payload.generatedAt}.`,
    "",
    "## Summary",
    "",
    `- Artifacts: ${payload.summary.artifacts}`,
    `- Model candidates: ${payload.summary.modelCandidates}`,
    `- Syntax-valid candidates: ${payload.summary.syntaxValidCandidates}`,
    `- Accepted by Brotli vs Terser: ${payload.summary.acceptedByBrotliVsTerser}`,
    `- Beat Round 3 by Brotli: ${payload.summary.beatsRound3Brotli}`,
    `- Aggregate delta vs Terser: raw ${payload.summary.deltaBytesVsTerser}, gzip ${payload.summary.deltaGzipVsTerser}, Brotli ${payload.summary.deltaBrotliVsTerser}`,
    `- Aggregate delta vs Round 3: raw ${payload.summary.deltaBytesVsRound3}, gzip ${payload.summary.deltaGzipVsRound3}, Brotli ${payload.summary.deltaBrotliVsRound3}`,
    "",
    "## Artifact Comparison",
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
  const candidatesByWindow = new Map(candidateSet.candidates.map((entry) => [entry.windowId, entry.responses ?? []]));
  const artifactCache = new Map();
  const baselineCache = new Map();
  const rows = [];

  for (const window of windowsPayload.windows) {
    rows.push(await runWindow(window, candidatesByWindow.get(window.id) ?? [], round3Rows, artifactCache, baselineCache));
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
  await writeFile(join(resultsDir, "round5.json"), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(join(resultsDir, "round5.md"), toMarkdown(payload, candidateSet));

  console.table(
    rows.map((row) => ({
      benchmark: row.benchmark,
      bestCandidate: row.bestCandidate,
      acceptedByBrotliVsTerser: row.acceptedByBrotliVsTerser,
      beatsRound3Brotli: row.beatsRound3Brotli,
      deltaBrotliVsTerser: row.deltaBrotliVsTerser,
      deltaBrotliVsRound3: row.deltaBrotliVsRound3,
    })),
  );
  console.log(`\nWrote ${join(resultsDir, "round5.json")} and ${join(resultsDir, "round5.md")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
