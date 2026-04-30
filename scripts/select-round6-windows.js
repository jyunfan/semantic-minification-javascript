import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import traverseModule from "@babel/traverse";
import generateModule from "@babel/generator";
import { parseProgram } from "./semantic-rewriter.js";

const traverse = traverseModule.default ?? traverseModule;
const generate = generateModule.default ?? generateModule;
const benchmarkDir = "benchmarks/round2";
const outputPath = "benchmarks/round6/windows.json";
const windowsPerArtifact = 5;

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function containsRejectedSyntax(source) {
  return /\b(eval|with|Function)\b|\bsuper\b|\byield\b|\bawait\b/.test(source);
}

function featuresFor(source) {
  const features = [];
  if (/\bif\b/.test(source)) features.push("if");
  if (/\breturn\b/.test(source)) features.push("return");
  if (/\?/.test(source)) features.push("conditional");
  if (/\belse\b/.test(source)) features.push("else");
  if (/&&|\|\|/.test(source)) features.push("logical");
  if (/\bthis\b/.test(source)) features.push("this");
  if (/\barguments\b/.test(source)) features.push("arguments");
  return features;
}

function scoreWindow(source) {
  let score = 0;
  score += countMatches(source, /\bif\b/g) * 5;
  score += countMatches(source, /\breturn\b/g) * 3;
  score += countMatches(source, /\?/g) * 2;
  score += countMatches(source, /\belse\b/g) * 2;
  score += countMatches(source, /&&|\|\|/g);
  score += countMatches(source, /\bvar\b/g);
  if (/\bthis\b|\barguments\b/.test(source)) score -= 8;
  if (/function\s*\(/.test(source)) score -= 1;
  if (source.length < 220) score += 4;
  if (source.length > 650) score -= 3;
  return score;
}

async function selectWindows(file) {
  const artifact = basename(file, ".js");
  const code = await readFile(join(benchmarkDir, file), "utf8");
  const ast = parseProgram(code);
  const candidates = [];

  traverse(ast, {
    Function(path) {
      const { node } = path;
      if (node.start == null || node.end == null) return;
      const source = code.slice(node.start, node.end);
      if (source.length < 120 || source.length > 700) return;
      if (!/(\bif\b|\?)/.test(source)) return;
      if (containsRejectedSyntax(source)) return;
      const score = scoreWindow(source);
      if (score < 8) return;
      candidates.push({
        artifact,
        start: node.start,
        end: node.end,
        sourceWindowBytes: Buffer.byteLength(source, "utf8"),
        sourceSha256: sha256(source),
        score,
        features: featuresFor(source),
        preview: generate(node, { comments: false, compact: false }).code,
      });
    },
  });

  candidates.sort((left, right) => right.score - left.score || left.sourceWindowBytes - right.sourceWindowBytes || left.start - right.start);
  return candidates.slice(0, windowsPerArtifact).map((candidate, index) => ({
    id: `${artifact}-window-${index + 1}`,
    rank: index + 1,
    ...candidate,
  }));
}

async function main() {
  const files = (await readdir(benchmarkDir)).filter((file) => file.endsWith(".js")).sort();
  const windows = [];
  for (const file of files) {
    windows.push(...(await selectWindows(file)));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    benchmarkDir,
    windowsPerArtifact,
    selectionPolicy: {
      nodeType: "Function",
      minChars: 120,
      maxChars: 700,
      requiredSyntax: ["if", "conditional expression"],
      rejectedSyntax: ["eval", "with", "Function constructor", "super", "yield", "await"],
      ordering: ["score desc", "sourceWindowBytes asc", "start asc"],
    },
    windows,
  };

  await mkdir("benchmarks/round6", { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.table(windows.map(({ id, artifact, start, end, sourceWindowBytes, score, features }) => ({
    id,
    artifact,
    start,
    end,
    sourceWindowBytes,
    score,
    features: features.join(","),
  })));
  console.log(`\nWrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
