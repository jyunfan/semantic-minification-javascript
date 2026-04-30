import { brotliCompressSync, gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { minify } from "terser";
import { generateCandidates, parseProgram } from "./semantic-rewriter.js";
import { round2Artifacts } from "./fetch-round2-artifacts.js";

const benchmarkDir = "benchmarks/round2";
const resultsDir = "results";
const promptPath = "PROMPT.md";
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

async function runBenchmark(file) {
  const start = performance.now();
  const artifactName = basename(file, ".js");
  const artifact = selectedArtifacts.get(artifactName);
  const original = await readFile(join(benchmarkDir, file), "utf8");
  const terserStart = performance.now();
  const terserCode = await terserMinify(original);
  const terserLatencyMs = performance.now() - terserStart;

  let candidates = [];
  let rewriteError = null;
  try {
    candidates = generateCandidates(original);
  } catch (error) {
    rewriteError = error instanceof Error ? error.message : String(error);
  }

  const verified = [];
  for (const candidate of candidates) {
    const minifyStart = performance.now();
    try {
      const minified = await terserMinify(candidate.code);
      if (validatesSyntax(minified)) {
        verified.push({
          ...candidate,
          minified,
          minifyLatencyMs: performance.now() - minifyStart,
        });
      }
    } catch {
      // Candidate is rejected when Terser or syntax validation fails.
    }
  }

  const best = verified.reduce(
    (current, candidate) => (byteSize(candidate.minified) < byteSize(current.code) ? { name: candidate.name, code: candidate.minified } : current),
    { name: "terser", code: terserCode },
  );

  return {
    benchmark: artifactName,
    version: artifact?.version ?? "unknown",
    originalBytes: byteSize(original),
    originalGzipBytes: gzipSize(original),
    originalBrotliBytes: brotliSize(original),
    terserBytes: byteSize(terserCode),
    terserGzipBytes: gzipSize(terserCode),
    terserBrotliBytes: brotliSize(terserCode),
    bestSemanticRule: best.name,
    bestSemanticBytes: byteSize(best.code),
    bestSemanticGzipBytes: gzipSize(best.code),
    bestSemanticBrotliBytes: brotliSize(best.code),
    deltaBytesVsTerser: byteSize(best.code) - byteSize(terserCode),
    deltaGzipVsTerser: gzipSize(best.code) - gzipSize(terserCode),
    improvementPct: Number((((byteSize(terserCode) - byteSize(best.code)) / byteSize(terserCode)) * 100).toFixed(4)),
    gzipImprovementPct: Number((((gzipSize(terserCode) - gzipSize(best.code)) / gzipSize(terserCode)) * 100).toFixed(4)),
    candidates: candidates.length,
    syntaxValidCandidates: verified.length,
    rewriteError,
    terserLatencyMs: Number(terserLatencyMs.toFixed(2)),
    totalLatencyMs: Number((performance.now() - start).toFixed(2)),
  };
}

function toMarkdown(rows, prompt) {
  const headers = [
    "benchmark",
    "version",
    "terserBytes",
    "bestSemanticRule",
    "bestSemanticBytes",
    "deltaBytesVsTerser",
    "improvementPct",
    "terserGzipBytes",
    "bestSemanticGzipBytes",
    "deltaGzipVsTerser",
    "gzipImprovementPct",
    "candidates",
    "syntaxValidCandidates",
    "totalLatencyMs",
  ];
  const lines = [
    "# Round 3 Results",
    "",
    "Corpus: pinned artifacts from privatenumber/minification-benchmarks.",
    "",
    `Prompt policy: ${promptPath}`,
    `Prompt SHA-256: ${sha256(prompt)}`,
    "",
    "Execution mode: local deterministic semantic rewrites derived from PROMPT.md; no API or LLM call.",
    "",
    "Validation note: this round verifies parseability/minifiability of rewritten artifacts. Full upstream artifact tests are future work.",
    "",
    `Generated at ${new Date().toISOString()}.`,
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  for (const row of rows) {
    lines.push(`| ${headers.map((header) => row[header]).join(" | ")} |`);
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const prompt = await readFile(promptPath, "utf8");
  const files = (await readdir(benchmarkDir)).filter((file) => file.endsWith(".js")).sort();
  const rows = [];
  for (const file of files) {
    rows.push(await runBenchmark(file));
  }

  await mkdir(resultsDir, { recursive: true });
  await writeFile(join(resultsDir, "round3.json"), `${JSON.stringify(rows, null, 2)}\n`);
  await writeFile(join(resultsDir, "round3.md"), toMarkdown(rows, prompt));

  console.table(
    rows.map((row) => ({
      benchmark: row.benchmark,
      terserBytes: row.terserBytes,
      bestSemanticRule: row.bestSemanticRule,
      bestSemanticBytes: row.bestSemanticBytes,
      deltaBytesVsTerser: row.deltaBytesVsTerser,
      improvementPct: row.improvementPct,
      deltaGzipVsTerser: row.deltaGzipVsTerser,
      gzipImprovementPct: row.gzipImprovementPct,
      candidates: row.candidates,
      syntaxValidCandidates: row.syntaxValidCandidates,
    })),
  );
  console.log(`\nWrote ${join(resultsDir, "round3.json")} and ${join(resultsDir, "round3.md")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
