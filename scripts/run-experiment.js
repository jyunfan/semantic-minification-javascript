import { brotliCompressSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { parse } from "@babel/parser";
import generateModule from "@babel/generator";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";
import { minify } from "terser";

const generate = generateModule.default ?? generateModule;
const traverse = traverseModule.default ?? traverseModule;
const benchmarkDir = "benchmarks/round1";
const resultsDir = "results";

function byteSize(code) {
  return Buffer.byteLength(code, "utf8");
}

function brotliSize(code) {
  return brotliCompressSync(Buffer.from(code)).byteLength;
}

function parseProgram(code) {
  return parse(code, {
    sourceType: "script",
    plugins: ["jsx"],
  });
}

function printProgram(ast) {
  return generate(ast, {
    comments: false,
    compact: false,
    jsescOption: { minimal: true },
  }).code;
}

function isBooleanLiteral(node, value) {
  return t.isBooleanLiteral(node) && node.value === value;
}

function compareToBooleanReplacement(path) {
  const { node } = path;
  if (!["===", "=="].includes(node.operator)) return false;

  const pairs = [
    [node.left, node.right, false],
    [node.right, node.left, true],
  ];

  for (const [expr, literal, swapped] of pairs) {
    if (!isBooleanLiteral(literal, true) && !isBooleanLiteral(literal, false)) {
      continue;
    }
    if (swapped && !["===", "=="].includes(node.operator)) continue;
    if (literal.value) {
      path.replaceWith(t.cloneNode(expr));
    } else {
      path.replaceWith(t.unaryExpression("!", t.cloneNode(expr), true));
    }
    return true;
  }

  return false;
}

function ternaryBooleanReplacement(path) {
  const { node } = path;
  if (isBooleanLiteral(node.consequent, true) && isBooleanLiteral(node.alternate, false)) {
    path.replaceWith(t.unaryExpression("!", t.unaryExpression("!", t.cloneNode(node.test), true), true));
    return true;
  }
  if (isBooleanLiteral(node.consequent, false) && isBooleanLiteral(node.alternate, true)) {
    path.replaceWith(t.unaryExpression("!", t.cloneNode(node.test), true));
    return true;
  }
  return false;
}

function ifReturnReplacement(path) {
  const { node } = path;
  if (!node.alternate) return false;
  if (!t.isBlockStatement(node.consequent) || !t.isBlockStatement(node.alternate)) return false;
  if (node.consequent.body.length !== 1 || node.alternate.body.length !== 1) return false;

  const left = node.consequent.body[0];
  const right = node.alternate.body[0];
  if (!t.isReturnStatement(left) || !t.isReturnStatement(right)) return false;

  path.replaceWith(
    t.returnStatement(t.conditionalExpression(t.cloneNode(node.test), t.cloneNode(left.argument), t.cloneNode(right.argument))),
  );
  return true;
}

function ifFollowedByReturnReplacement(path) {
  const { node } = path;
  if (node.alternate) return false;
  if (!t.isBlockStatement(node.consequent) || node.consequent.body.length !== 1) return false;

  const consequentReturn = node.consequent.body[0];
  if (!t.isReturnStatement(consequentReturn)) return false;

  const siblings = path.getAllNextSiblings();
  const next = siblings[0];
  if (!next || !t.isReturnStatement(next.node)) return false;

  path.replaceWith(
    t.returnStatement(
      t.conditionalExpression(t.cloneNode(node.test), t.cloneNode(consequentReturn.argument), t.cloneNode(next.node.argument)),
    ),
  );
  next.remove();
  return true;
}

function ifAssignmentReplacement(path) {
  const { node } = path;
  if (!node.alternate) return false;
  if (!t.isBlockStatement(node.consequent) || !t.isBlockStatement(node.alternate)) return false;
  if (node.consequent.body.length !== 1 || node.alternate.body.length !== 1) return false;

  const left = node.consequent.body[0];
  const right = node.alternate.body[0];
  if (!t.isExpressionStatement(left) || !t.isExpressionStatement(right)) return false;
  if (!t.isAssignmentExpression(left.expression) || !t.isAssignmentExpression(right.expression)) return false;
  if (left.expression.operator !== "=" || right.expression.operator !== "=") return false;
  if (!t.isNodesEquivalent(left.expression.left, right.expression.left)) return false;

  path.replaceWith(
    t.expressionStatement(
      t.assignmentExpression(
        "=",
        t.cloneNode(left.expression.left),
        t.conditionalExpression(t.cloneNode(node.test), t.cloneNode(left.expression.right), t.cloneNode(right.expression.right)),
      ),
    ),
  );
  return true;
}

const rewriteRules = [
  {
    name: "boolean-comparison",
    apply(ast) {
      let changed = false;
      traverse(ast, {
        BinaryExpression(path) {
          changed = compareToBooleanReplacement(path) || changed;
        },
      });
      return changed;
    },
  },
  {
    name: "boolean-ternary",
    apply(ast) {
      let changed = false;
      traverse(ast, {
        ConditionalExpression(path) {
          changed = ternaryBooleanReplacement(path) || changed;
        },
      });
      return changed;
    },
  },
  {
    name: "if-return",
    apply(ast) {
      let changed = false;
      traverse(ast, {
        IfStatement(path) {
          changed = ifReturnReplacement(path) || ifFollowedByReturnReplacement(path) || changed;
        },
      });
      return changed;
    },
  },
  {
    name: "if-assignment",
    apply(ast) {
      let changed = false;
      traverse(ast, {
        IfStatement(path) {
          changed = ifAssignmentReplacement(path) || changed;
        },
      });
      return changed;
    },
  },
];

function generateCandidates(originalCode) {
  const candidates = [];

  for (const rule of rewriteRules) {
    const ast = t.cloneNode(parseProgram(originalCode), true);
    if (rule.apply(ast)) {
      candidates.push({ name: rule.name, code: printProgram(ast) });
    }
  }

  const combined = t.cloneNode(parseProgram(originalCode), true);
  const applied = rewriteRules.filter((rule) => rule.apply(combined)).map((rule) => rule.name);
  if (applied.length > 1) {
    candidates.push({ name: `combined:${applied.join("+")}`, code: printProgram(combined) });
  }

  return candidates;
}

function loadModule(code, filename) {
  const module = { exports: {} };
  const context = vm.createContext({
    module,
    exports: module.exports,
    console,
  });
  const script = new vm.Script(code, { filename, timeout: 1000 });
  script.runInContext(context, { timeout: 1000 });
  return module.exports;
}

function deepEqual(actual, expected) {
  return Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected);
}

function validateCandidate(originalCode, candidateCode, tests, filename) {
  let originalExports;
  let candidateExports;
  try {
    originalExports = loadModule(originalCode, `${filename}:original`);
    candidateExports = loadModule(candidateCode, `${filename}:candidate`);
  } catch {
    return false;
  }

  for (const [exportName, cases] of Object.entries(tests)) {
    if (typeof originalExports[exportName] !== "function" || typeof candidateExports[exportName] !== "function") {
      return false;
    }
    for (const [args, expected] of cases) {
      let actualOriginal;
      let actualCandidate;
      try {
        actualOriginal = originalExports[exportName](...args);
        actualCandidate = candidateExports[exportName](...args);
      } catch {
        return false;
      }
      if (!deepEqual(actualOriginal, expected) || !deepEqual(actualCandidate, expected)) {
        return false;
      }
    }
  }
  return true;
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

async function runBenchmark(file) {
  const start = performance.now();
  const sourcePath = join(benchmarkDir, file);
  const testPath = join(benchmarkDir, file.replace(/\.js$/, ".tests.json"));
  const original = await readFile(sourcePath, "utf8");
  const tests = JSON.parse(await readFile(testPath, "utf8"));
  const terserCode = await terserMinify(original);
  const candidates = generateCandidates(original);
  const verified = [];

  for (const candidate of candidates) {
    const minified = await terserMinify(candidate.code);
    if (validateCandidate(original, minified, tests, file)) {
      verified.push({ ...candidate, minified });
    }
  }

  const best = verified.reduce(
    (current, candidate) => (byteSize(candidate.minified) < byteSize(current.code) ? { name: candidate.name, code: candidate.minified } : current),
    { name: "terser", code: terserCode },
  );

  return {
    benchmark: basename(file, ".js"),
    originalBytes: byteSize(original),
    originalBrotliBytes: brotliSize(original),
    terserBytes: byteSize(terserCode),
    terserBrotliBytes: brotliSize(terserCode),
    bestSemanticRule: best.name,
    bestSemanticBytes: byteSize(best.code),
    bestSemanticBrotliBytes: brotliSize(best.code),
    candidates: candidates.length,
    verifiedCandidates: verified.length,
    latencyMs: Number((performance.now() - start).toFixed(2)),
  };
}

function toMarkdown(rows) {
  const headers = [
    "benchmark",
    "originalBytes",
    "terserBytes",
    "bestSemanticRule",
    "bestSemanticBytes",
    "deltaVsTerser",
    "candidates",
    "verifiedCandidates",
    "latencyMs",
  ];
  const lines = [
    `# Round 1 Results`,
    "",
    `Generated at ${new Date().toISOString()}.`,
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  for (const row of rows) {
    const values = headers.map((header) => {
      if (header === "deltaVsTerser") return row.bestSemanticBytes - row.terserBytes;
      return row[header];
    });
    lines.push(`| ${values.join(" | ")} |`);
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const files = (await readdir(benchmarkDir)).filter((file) => file.endsWith(".js")).sort();
  const rows = [];
  for (const file of files) {
    rows.push(await runBenchmark(file));
  }

  await mkdir(resultsDir, { recursive: true });
  await writeFile(join(resultsDir, "round1.json"), `${JSON.stringify(rows, null, 2)}\n`);
  await writeFile(join(resultsDir, "round1.md"), toMarkdown(rows));

  console.table(rows);
  console.log(`\nWrote ${join(resultsDir, "round1.json")} and ${join(resultsDir, "round1.md")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
