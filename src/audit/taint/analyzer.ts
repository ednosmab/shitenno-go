/**
 * analyzer.ts — Taint Analyzer using TypeScript Compiler API
 *
 * Analyzes source code for taint flow from sources to sinks.
 * Uses the TypeScript Compiler API for accurate type-aware analysis.
 */

import * as ts from "typescript";
import { statSync } from "node:fs";
import { createHash } from "node:crypto";
import type { TaintNode, TaintIssue } from "./types.js";
import { isTaintSource } from "./sources.js";
import { findTaintSink } from "./sinks.js";
import { isSanitizer } from "./sanitizers.js";
import { DataFlowGraph } from "./graph.js";
import type { TaintSourceDef } from "./types.js";
import { logger } from "../../logger.js";

export interface TaintAnalyzerOptions {
  /** Project root directory */
  projectRoot: string;
  /** Maximum taint propagation depth */
  maxDepth?: number;
  /** Enable cross-file analysis */
  crossFile?: boolean;
  /** Only report issues above this severity */
  minSeverity?: 1 | 2 | 3;
}

interface VariableInfo {
  name: string;
  tainted: boolean;
  source?: TaintSourceDef;
  declarations: ts.Node[];
}

export class TaintAnalyzer {
  private program: ts.Program;
  private checker: ts.TypeChecker;
  private graph: DataFlowGraph;
  private options: Required<TaintAnalyzerOptions>;

  private variableTaint: Map<string, VariableInfo> = new Map();
  private static programCache = new Map<string, ts.Program>();
  private nodeCounter = 0;

  /** Clear the static program cache (useful between test runs to avoid OOM) */
  static clearCache(): void {
    TaintAnalyzer.programCache.clear();
  }

  constructor(options: TaintAnalyzerOptions) {
    this.options = {
      maxDepth: options.maxDepth ?? 20,
      crossFile: options.crossFile ?? false,
      minSeverity: options.minSeverity ?? 1,
      projectRoot: options.projectRoot,
    };

    // Create TypeScript program
    const configPath = ts.findConfigFile(
      this.options.projectRoot,
      ts.sys.fileExists,
      "tsconfig.json",
    );

    let compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    };

    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      if (!configFile.error) {
        const parsed = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          this.options.projectRoot,
        );
        compilerOptions = { ...parsed.options, noEmit: true };
      }
    }

    // Collect all .ts files in src/
    const srcDir = this.options.projectRoot + "/src";
    const fileNames = this.collectSourceFiles(srcDir);

    // Build cache key from tsconfig hash + file mtimes so cache invalidates on changes
    const cacheKey = this.buildCacheKey(configPath, fileNames);
    this.program = TaintAnalyzer.programCache.get(cacheKey) ?? ts.createProgram(fileNames, compilerOptions);
    TaintAnalyzer.programCache.set(cacheKey, this.program);
    this.checker = this.program.getTypeChecker();
    this.graph = new DataFlowGraph();
  }

  /** Collect all .ts source files in src/ */
  private collectSourceFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = ts.sys.readDirectory(dir, [".ts"], ["node_modules", "__tests__", "dist"]);
    if (entries) {
      for (const entry of entries) {
        if (!/\.test\.(ts|tsx|js|jsx)$/.test(entry) && !/\.bench\.(ts|tsx|js|jsx)$/.test(entry)) {
          files.push(entry);
        }
      }
    }
    return files;
  }

  /** Build a cache key from tsconfig content + source file mtimes */
  private buildCacheKey(configPath: string | undefined, fileNames: string[]): string {
    const hash = createHash("md5");
    if (configPath) {
      try {
        const stat = statSync(configPath);
        hash.update(String(stat.mtimeMs));
      } catch (error) {
        logger.debug("analyzer", "Suppressed error", { error });
      }
    }
    for (const f of fileNames) {
      try {
        const stat = statSync(f);
        hash.update(f + ":" + stat.mtimeMs);
      } catch (error) {
        logger.debug("analyzer", "Suppressed error", { error });
      }
    }
    return hash.digest("hex");
  }

  /** Generate a unique node ID */
  private nextNodeId(): string {
    return `n${this.nodeCounter++}`;
  }


  /** Extract the full name of a property access expression (e.g., "req.body.user") */
  private getPropertyAccessName(node: ts.PropertyAccessExpression): string {
    const parts: string[] = [];
    let current: ts.Node = node;
    while (ts.isPropertyAccessExpression(current)) {
      parts.unshift(current.name.getText());
      current = current.expression;
    }
    if (ts.isIdentifier(current)) {
      parts.unshift(current.getText());
    }
    return parts.join(".");
  }

  /** Get the name of a function being called */
  private getCallName(node: ts.CallExpression): string {
    if (ts.isPropertyAccessExpression(node.expression)) {
      return this.getPropertyAccessName(node.expression);
    }
    if (ts.isIdentifier(node.expression)) {
      return node.expression.getText();
    }
    return "";
  }

  private resolveSymbolFromWrapper(node: ts.Node): string | undefined {
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) {
      return this.getSymbolName(node.expression);
    }
    return undefined;
  }

  private resolveSymbolFromBinary(node: ts.Node): string | undefined {
    if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.PlusToken) {
      return undefined;
    }
    const left = this.getSymbolName(node.left);
    const right = this.getSymbolName(node.right);
    if (left && this.variableTaint.get(left)?.tainted) return left;
    if (right && this.variableTaint.get(right)?.tainted) return right;
    return undefined;
  }

  private resolveSymbolFromTemplate(node: ts.Node): string | undefined {
    if (!ts.isTemplateExpression(node)) return undefined;
    for (const span of node.templateSpans) {
      const name = this.getSymbolName(span.expression);
      if (name && this.variableTaint.get(name)?.tainted) return name;
    }
    return undefined;
  }

  private resolveSymbolFromNode(node: ts.Node): string | undefined {
    if (ts.isPropertyAccessExpression(node)) return this.getPropertyAccessName(node);
    if (ts.isElementAccessExpression(node)) return this.getSymbolName(node.expression);
    const symbol = this.checker.getSymbolAtLocation(node);
    if (symbol) return symbol.getName();
    if (ts.isIdentifier(node)) return node.getText();
    return undefined;
  }

  /** Get the symbol name for a variable reference */
  private getSymbolName(node: ts.Node): string | undefined {
    return this.resolveSymbolFromWrapper(node)
      ?? this.resolveSymbolFromBinary(node)
      ?? this.resolveSymbolFromTemplate(node)
      ?? this.resolveSymbolFromNode(node);
  }

  private createTaintNodeAt(variableName: string, kind: "source" | "sink" | "assignment", text: string, tsNode: ts.Node): TaintNode {
    const sourceFile = tsNode.getSourceFile();
    const nodeId = this.nextNodeId();
    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, tsNode.getStart());
    return {
      id: nodeId,
      kind,
      variableName,
      sourceFile: sourceFile.fileName,
      line: line + 1,
      column: character + 1,
      text,
    };
  }

  private findExistingSourceNode(variableName: string): TaintNode | undefined {
    return this.graph.getNodes().find(
      (n) => (n.kind === "source" || n.kind === "assignment") && n.variableName === variableName,
    );
  }

  private visitSource(node: ts.Node): void {
    if (!ts.isPropertyAccessExpression(node)) return;
    const fullName = this.getPropertyAccessName(node);
    const sourceDef = isTaintSource(fullName);
    if (!sourceDef) return;

    const taintNode = this.createTaintNodeAt(fullName, "source", fullName, node);
    this.graph.addNode(taintNode);

    this.variableTaint.set(fullName, {
      name: fullName,
      tainted: true,
      source: sourceDef,
      declarations: [],
    });
  }

  private findTaintedArgument(node: ts.CallExpression): string | undefined {
    for (const arg of node.arguments) {
      const argName = this.getSymbolName(arg);
      if (argName && this.variableTaint.get(argName)?.tainted) {
        return argName;
      }
    }
    return undefined;
  }

  private visitSink(node: ts.CallExpression): void {
    const funcName = this.getCallName(node);
    const sinkDef = findTaintSink(funcName);
    if (!sinkDef) return;

    const sourceVar = this.findTaintedArgument(node);
    const taintNode = this.createTaintNodeAt(funcName, "sink", funcName, node);
    this.graph.addNode(taintNode);

    if (!sourceVar) return;
    const sourceNode = this.findExistingSourceNode(sourceVar);
    if (sourceNode) {
      this.graph.addEdge({ from: sourceNode.id, to: taintNode.id, kind: "parameter" });
    }
  }

  private isFunctionLikeDeclaration(declaration: ts.Node): boolean {
    return ts.isFunctionDeclaration(declaration)
      || ts.isArrowFunction(declaration)
      || ts.isMethodDeclaration(declaration)
      || ts.isFunctionExpression(declaration);
  }

  private propagateTaintAtCall(node: ts.CallExpression): void {
    const signature = this.checker.getResolvedSignature(node);
    const declaration = signature?.getDeclaration();
    if (!declaration || !this.isFunctionLikeDeclaration(declaration)) return;

    node.arguments.forEach((arg, index) => {
      const argName = this.getSymbolName(arg);
      const argInfo = argName ? this.variableTaint.get(argName) : undefined;
      if (!argInfo?.tainted) return;
      const param = declaration.parameters[index];
      if (!param) return;
      const paramName = param.name.getText();
      this.variableTaint.set(paramName, {
        name: paramName,
        tainted: true,
        source: argInfo.source,
        declarations: [param],
      });
    });
  }

  private handleCommanderAction(node: ts.CallExpression): void {
    if (!ts.isPropertyAccessExpression(node.expression)) return;
    if (node.expression.name.text !== "action") return;
    const callback = node.arguments[0];
    if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return;
    const param = callback.parameters[0];
    if (!param) return;
    const paramName = param.name.getText();
    this.variableTaint.set(paramName, {
      name: paramName,
      tainted: true,
      source: { pattern: /^opts$/, kind: "parameter", description: "Commander .action() callback parameter" },
      declarations: [param],
    });
  }

  private visitCallExpression(node: ts.CallExpression): void {
    this.visitSink(node);
    this.propagateTaintAtCall(node);
    this.handleCommanderAction(node);
  }

  private visitAssignment(node: ts.BinaryExpression, sourceFile: ts.SourceFile): void {
    const leftName = this.getSymbolName(node.left);
    const rightName = this.getSymbolName(node.right);
    if (!leftName || !rightName) return;
    const rightInfo = this.variableTaint.get(rightName);
    if (!rightInfo?.tainted) return;

    const leftSymbol = this.checker.getSymbolAtLocation(node.left);
    const actualLeftName = leftSymbol?.getName() ?? leftName;

    this.variableTaint.set(actualLeftName, {
      name: actualLeftName,
      tainted: true,
      source: rightInfo.source,
      declarations: [],
    });

    const leftNodeId = this.nextNodeId();
    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const taintNode: TaintNode = {
      id: leftNodeId,
      kind: "assignment",
      variableName: actualLeftName,
      sourceFile: sourceFile.fileName,
      line: line + 1,
      column: character + 1,
      text: `${actualLeftName} = ${rightName}`,
    };
    this.graph.addNode(taintNode);

    const rightNode = this.findExistingSourceNode(rightName);
    if (rightNode) {
      this.graph.addEdge({ from: rightNode.id, to: leftNodeId, kind: "assignment" });
    }
  }

  private visitVarDeclaration(node: ts.VariableDeclaration, sourceFile: ts.SourceFile): void {
    if (!node.initializer) return;
    const varName = this.getSymbolName(node.name);
    const initName = this.getSymbolName(node.initializer);
    if (!varName || !initName) return;
    const initInfo = this.variableTaint.get(initName);
    if (!initInfo?.tainted) return;

    this.variableTaint.set(varName, {
      name: varName,
      tainted: true,
      source: initInfo.source,
      declarations: [node],
    });

    const nodeId = this.nextNodeId();
    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const taintNode: TaintNode = {
      id: nodeId,
      kind: "assignment",
      variableName: varName,
      sourceFile: sourceFile.fileName,
      line: line + 1,
      column: character + 1,
      text: `const ${varName} = ${initName}`,
    };
    this.graph.addNode(taintNode);

    const initNode = this.findExistingSourceNode(initName);
    if (initNode) {
      this.graph.addEdge({ from: initNode.id, to: nodeId, kind: "assignment" });
    }
  }

  /** Visit a node and perform taint analysis */
  private visit(node: ts.Node, sourceFile: ts.SourceFile): void {
    ts.forEachChild(node, (child) => this.visit(child, sourceFile));
    this.visitSource(node);
    if (ts.isCallExpression(node)) {
      this.visitCallExpression(node);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      this.visitAssignment(node, sourceFile);
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      this.visitVarDeclaration(node, sourceFile);
    }
  }

  private analyzeSourceFiles(sourceFiles: readonly ts.SourceFile[]): void {
    for (const sourceFile of sourceFiles) {
      if (sourceFile.isDeclarationFile) continue;
      if (sourceFile.fileName.includes("node_modules")) continue;
      this.visit(sourceFile, sourceFile);
    }
  }

  private findSourceNodesReaching(sink: TaintNode, nodes: TaintNode[]): TaintNode[] {
    const reachers = this.graph.getReachers(sink.id, this.options.maxDepth);
    return nodes.filter((n) => n.kind === "source" && reachers.includes(n.id));
  }

  private checkPathHasSanitizer(sourceId: string, sinkId: string): boolean {
    const pathNodes = this.graph.findPath(sourceId, sinkId);
    return pathNodes?.some((nodeId) => {
      const graphNode = this.graph.getNode(nodeId);
      return graphNode?.kind === "sanitizer" || (graphNode?.variableName ? isSanitizer(graphNode.variableName) !== undefined : false);
    }) ?? false;
  }

  private formatTaintDescription(sourceNodes: TaintNode[], sinkDef: ReturnType<typeof findTaintSink>, fallbackSinkText: string): string {
    const sourceNames = sourceNodes.map((s) => s.variableName ?? s.text).join(", ");
    const sinkDescription = sinkDef?.description ?? fallbackSinkText;
    return `Tainted data from ${sourceNames} reaches ${sinkDescription} without sanitization`;
  }

  private buildIssue(sink: TaintNode, sourceNodes: TaintNode[]): TaintIssue {
    const sinkDef = findTaintSink(sink.variableName ?? "");
    const hasSanitizer = this.checkPathHasSanitizer(sourceNodes[0]?.id ?? "", sink.id);
    return {
      type: sinkDef?.issueType ?? "tainted_input",
      severity: sinkDef?.severity ?? 2,
      description: this.formatTaintDescription(sourceNodes, sinkDef, sink.text),
      location: sink.sourceFile.replace(this.options.projectRoot + "/", "") + ":" + sink.line,
      sourceType: sourceNodes[0]?.variableName ?? "unknown",
      sinkType: sinkDef?.name ?? "unknown",
      isSanitized: hasSanitizer,
      recommendation: `Sanitize input before using in ${sinkDef?.name ?? "sink function"}`,
    };
  }

  private collectIssues(): TaintIssue[] {
    const nodes = this.graph.getNodes();
    const issues: TaintIssue[] = [];
    for (const sink of nodes) {
      if (sink.kind !== "sink") continue;
      const sourceNodes = this.findSourceNodesReaching(sink, nodes);
      if (sourceNodes.length === 0) continue;
      const issue = this.buildIssue(sink, sourceNodes);
      if (issue.severity >= this.options.minSeverity) {
        issues.push(issue);
      }
    }
    return issues;
  }

  /** Run taint analysis on all source files */
  analyze(): TaintIssue[] {
    this.analyzeSourceFiles(this.program.getSourceFiles());
    return this.collectIssues();
  }

  /** Get the data flow graph (for debugging/visualization) */
  getGraph(): DataFlowGraph {
    return this.graph;
  }

  /** Get variable taint information */
  getVariableTaint(): Map<string, VariableInfo> {
    return this.variableTaint;
  }
}
