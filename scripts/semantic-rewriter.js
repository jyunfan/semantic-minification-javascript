import { parse } from "@babel/parser";
import generateModule from "@babel/generator";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";

const generate = generateModule.default ?? generateModule;
const traverse = traverseModule.default ?? traverseModule;

export function parseProgram(code) {
  return parse(code, {
    sourceType: "unambiguous",
    plugins: [
      "jsx",
      "classProperties",
      "classPrivateProperties",
      "classPrivateMethods",
      "dynamicImport",
      "importMeta",
      "objectRestSpread",
      "optionalCatchBinding",
      "optionalChaining",
      "nullishCoalescingOperator",
      "numericSeparator",
      "topLevelAwait",
    ],
  });
}

export function printProgram(ast) {
  return generate(ast, {
    comments: false,
    compact: false,
    jsescOption: { minimal: true },
  }).code;
}

function isBooleanLiteral(node, value) {
  return t.isBooleanLiteral(node) && node.value === value;
}

function booleanTernaryReplacement(path) {
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

export const safeRewriteRules = [
  {
    name: "boolean-ternary",
    apply(ast) {
      let changed = false;
      traverse(ast, {
        ConditionalExpression(path) {
          changed = booleanTernaryReplacement(path) || changed;
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

export function generateCandidates(originalCode, rules = safeRewriteRules) {
  const candidates = [];

  for (const rule of rules) {
    const ast = t.cloneNode(parseProgram(originalCode), true);
    if (rule.apply(ast)) {
      candidates.push({ name: rule.name, code: printProgram(ast) });
    }
  }

  const combined = t.cloneNode(parseProgram(originalCode), true);
  const applied = rules.filter((rule) => rule.apply(combined)).map((rule) => rule.name);
  if (applied.length > 1) {
    candidates.push({ name: `combined:${applied.join("+")}`, code: printProgram(combined) });
  }

  return candidates;
}
