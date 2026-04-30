import { createHash } from "node:crypto";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { performance } from "node:perf_hooks";
import { minify } from "terser";
import { parseProgram } from "./semantic-rewriter.js";
import { round2Artifacts } from "./fetch-round2-artifacts.js";

const benchmarkDir = "benchmarks/round2";
const candidatePath = "benchmarks/round4/llm-candidates.json";
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

async function loadBaseline(artifactName, original, cache) {
  if (!cache.has(artifactName)) {
    const code = await terserMinify(original);
    cache.set(artifactName, {
      code,
      bytes: byteSize(code),
      gzipBytes: gzipSize(code),
      brotliBytes: brotliSize(code),
    });
  }
  return cache.get(artifactName);
}

function spliceCandidate(original, entry, response) {
  const sourceWindow = original.slice(entry.start, entry.end);
  if (sha256(sourceWindow) !== entry.sourceSha256) {
    throw new Error("source window hash mismatch");
  }
  return `${original.slice(0, entry.start)}${response.code}${original.slice(entry.end)}`;
}

function pickBestByBrotli(baseline, candidates) {
  return candidates.reduce((best, candidate) => {
    if (candidate.brotliBytes !== best.brotliBytes) return candidate.brotliBytes < best.brotliBytes ? candidate : best;
    if (candidate.gzipBytes !== best.gzipBytes) return candidate.gzipBytes < best.gzipBytes ? candidate : best;
    return candidate.bytes < best.bytes ? candidate : best;
  }, baseline);
}

async function runEntry(entry, artifactCache, baselineCache) {
  const start = performance.now();
  const original = await loadArtifact(entry.artifact, artifactCache);
  const baseline = await loadBaseline(entry.artifact, original, baselineCache);
  const verified = [];
  const rejected = [];

  for (const response of entry.responses ?? []) {
    try {
      const candidateCode = spliceCandidate(original, entry, response);
      const minified = await terserMinify(candidateCode);
      if (!validatesSyntax(minified)) {
        rejected.push({ name: response.name, error: "minified output failed syntax validation" });
        continue;
      }
      verified.push({
        name: response.name,
        code: minified,
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

  const best = pickBestByBrotli({ name: "terser", ...baseline }, verified);
  const artifact = selectedArtifacts.get(entry.artifact);

  return {
    id: entry.id,
    benchmark: entry.artifact,
    version: artifact?.version ?? "unknown",
    sourceWindowBytes: entry.end - entry.start,
    modelCandidates: entry.responses?.length ?? 0,
    syntaxValidCandidates: verified.length,
    rejectedCandidates: rejected.length,
    bestCandidate: best.name,
    acceptedByBrotli: best.name !== "terser" && best.brotliBytes < baseline.brotliBytes,
    terserBytes: baseline.bytes,
    bestBytes: best.bytes,
    deltaBytesVsTerser: best.bytes - baseline.bytes,
    terserGzipBytes: baseline.gzipBytes,
    bestGzipBytes: best.gzipBytes,
    deltaGzipVsTerser: best.gzipBytes - baseline.gzipBytes,
    terserBrotliBytes: baseline.brotliBytes,
    bestBrotliBytes: best.brotliBytes,
    deltaBrotliVsTerser: best.brotliBytes - baseline.brotliBytes,
    rejected,
    latencyMs: Number((performance.now() - start).toFixed(2)),
  };
}

function summarize(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.windows += 1;
      summary.modelCandidates += row.modelCandidates;
      summary.syntaxValidCandidates += row.syntaxValidCandidates;
      summary.acceptedByBrotli += row.acceptedByBrotli ? 1 : 0;
      summary.deltaBytesVsTerser += row.deltaBytesVsTerser;
      summary.deltaGzipVsTerser += row.deltaGzipVsTerser;
      summary.deltaBrotliVsTerser += row.deltaBrotliVsTerser;
      return summary;
    },
    {
      windows: 0,
      modelCandidates: 0,
      syntaxValidCandidates: 0,
      acceptedByBrotli: 0,
      deltaBytesVsTerser: 0,
      deltaGzipVsTerser: 0,
      deltaBrotliVsTerser: 0,
    },
  );
}

function toMarkdown(payload, candidateSet) {
  const headers = [
    "id",
    "benchmark",
    "version",
    "sourceWindowBytes",
    "modelCandidates",
    "syntaxValidCandidates",
    "bestCandidate",
    "acceptedByBrotli",
    "deltaBytesVsTerser",
    "deltaGzipVsTerser",
    "deltaBrotliVsTerser",
    "latencyMs",
  ];
  const lines = [
    "# Round 4 Results",
    "",
    "Corpus: selected source windows from pinned real-project artifacts used in Round 2.",
    "",
    `Candidate source: ${candidatePath}`,
    `Candidate generation mode: ${candidateSet.generationMode}`,
    `Candidate model: ${candidateSet.model}`,
    "",
    "Execution mode: cached LLM-generated direct JavaScript rewrites; each response is spliced into the original artifact, minified by Terser, syntax-checked, and scored by Brotli first.",
    "",
    "Validation note: this round does not run upstream behavioral test suites. It validates source-window hash, Terser minifiability, and post-minify syntax only.",
    "",
    `Generated at ${payload.generatedAt}.`,
    "",
    "## Summary",
    "",
    `- Windows: ${payload.summary.windows}`,
    `- Model candidates: ${payload.summary.modelCandidates}`,
    `- Syntax-valid candidates: ${payload.summary.syntaxValidCandidates}`,
    `- Accepted by Brotli: ${payload.summary.acceptedByBrotli}`,
    `- Aggregate raw delta vs Terser baselines: ${payload.summary.deltaBytesVsTerser}`,
    `- Aggregate gzip delta vs Terser baselines: ${payload.summary.deltaGzipVsTerser}`,
    `- Aggregate Brotli delta vs Terser baselines: ${payload.summary.deltaBrotliVsTerser}`,
    "",
    "## Candidate Windows",
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
  const candidateSet = JSON.parse(await readFile(candidatePath, "utf8"));
  const artifactCache = new Map();
  const baselineCache = new Map();
  const rows = [];

  for (const entry of candidateSet.candidates) {
    rows.push(await runEntry(entry, artifactCache, baselineCache));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    candidatePath,
    candidateGenerationMode: candidateSet.generationMode,
    candidateModel: candidateSet.model,
    summary: summarize(rows),
    rows,
  };

  await mkdir(resultsDir, { recursive: true });
  await writeFile(join(resultsDir, "round4.json"), `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(join(resultsDir, "round4.md"), toMarkdown(payload, candidateSet));

  console.table(
    rows.map((row) => ({
      id: row.id,
      benchmark: row.benchmark,
      bestCandidate: row.bestCandidate,
      acceptedByBrotli: row.acceptedByBrotli,
      deltaBytesVsTerser: row.deltaBytesVsTerser,
      deltaGzipVsTerser: row.deltaGzipVsTerser,
      deltaBrotliVsTerser: row.deltaBrotliVsTerser,
    })),
  );
  console.log(`\nWrote ${join(resultsDir, "round4.json")} and ${join(resultsDir, "round4.md")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
