/**
 * analyzer.ts — Cyclomatic complexity analyzer using TypeScript Compiler API
 *
 * Accurately measures McCabe cyclomatic complexity via AST traversal,
 * replacing the previous regex/brace-counting heuristic.
 */

import * as ts from "typescript";

export interface ComplexityResult {
  functionName: string;
  line: number;
  complexity: number;
}

/** Decision nodes that increment cyclomatic complexity (McCabe). */
function isDecisionPoint(node: ts.Node): boolean {
  return (
    ts.isIfStatement(node) ||
    ts.isConditionalExpression(node) ||
    ts.isCaseClause(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isCatchClause(node) ||
    (ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
       node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
       node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))
  );
}

function getFunctionName(node: ts.FunctionLikeDeclaration, sourceFile: ts.SourceFile): string {
  try {
    if (node.name && ts.isIdentifier(node.name)) return node.name.text;
    if (ts.isConstructorDeclaration(node)) return "constructor";
    if (ts.isArrowFunction(node) && node.parent && ts.isVariableDeclaration(node.parent) && node.parent.name && ts.isIdentifier(node.parent.name)) {
      return node.parent.name.text;
    }
    return `<anonymous@${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}>`;
  } catch {
    return "<unknown>";
  }
}

/** Analyze cyclomatic complexity for all functions in a source file. */
export function analyzeComplexity(_program: ts.Program, sourceFile: ts.SourceFile): ComplexityResult[] {
  const results: ComplexityResult[] = [];

  function visitFunction(fnNode: ts.FunctionLikeDeclaration): void {
    let complexity = 1; // baseline McCabe

    function count(node: ts.Node): void {
      if (isDecisionPoint(node)) complexity++;
      // Don't descend into nested functions — each has its own count
      if (node !== fnNode && ts.isFunctionLike(node)) return;
      ts.forEachChild(node, count);
    }

    if (fnNode.body) {
      count(fnNode.body);
    }

    let line = 0;
    try {
      line = sourceFile.getLineAndCharacterOfPosition(fnNode.getStart(sourceFile)).line;
    } catch {
      // getStart() may fail for standalone source files (ts.createSourceFile fallback)
    }
    results.push({
      functionName: getFunctionName(fnNode, sourceFile),
      line: line + 1,
      complexity,
    });
  }

  function walk(node: ts.Node): void {
    // Only visit function-like declarations that have a body
    // (excludes SignatureDeclaration / overload signatures)
    if (
      ts.isFunctionLike(node) &&
      "body" in node &&
      node.body
    ) {
      try {
        visitFunction(node as ts.FunctionLikeDeclaration);
      } catch {
        // Skip functions that can't be analyzed (e.g., standalone source files)
      }
    }
    ts.forEachChild(node, walk);
  }

  walk(sourceFile);

  return results;
}
