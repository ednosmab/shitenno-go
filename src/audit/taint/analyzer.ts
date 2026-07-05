/**
 * analyzer.ts — Taint Analyzer using TypeScript Compiler API
 *
 * Analyzes source code for taint flow from sources to sinks.
 * Uses the TypeScript Compiler API for accurate type-aware analysis.
 */

import * as ts from "typescript";
import type { TaintNode, TaintEdge, TaintIssue, TaintPath } from "./types.js";
import { isTaintSource } from "./sources.js";
import { findTaintSink } from "./sinks.js";
import { isSanitizer } from "./sanitizers.js";
import { DataFlowGraph } from "./graph.js";
import type { TaintSourceDef, TaintSinkDef } from "./types.js";

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

    const cacheKey = this.options.projectRoot;
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
        if (!entry.includes(".test.ts") && !entry.includes(".bench.ts") && !entry.includes("index.ts")) {
          files.push(entry);
        }
      }
    }
    return files;
  }

  /** Generate a unique node ID */
  private nextNodeId(): string {
    return `n${this.nodeCounter++}`;
  }

  /** Get a human-readable location string */
  private getLocation(node: ts.Node): string {
    const sourceFile = node.getSourceFile();
    const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
    const fileName = sourceFile.fileName.replace(this.options.projectRoot + "/", "");
    return `${fileName}:${line + 1}:${character + 1}`;
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

  /** Get the symbol name for a variable reference */
  private getSymbolName(node: ts.Node): string | undefined {
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) {
      return this.getSymbolName(node.expression);
    }
    if (ts.isPropertyAccessExpression(node)) {
      return this.getPropertyAccessName(node);
    }
    if (ts.isElementAccessExpression(node)) {
      return this.getSymbolName(node.expression);
    }
    const symbol = this.checker.getSymbolAtLocation(node);
    if (symbol) {
      return symbol.getName();
    }
    if (ts.isIdentifier(node)) {
      return node.getText();
    }
    return undefined;
  }

  /** Visit a node and perform taint analysis */
  private visit(node: ts.Node, sourceFile: ts.SourceFile): void {
    // Post-order: visit children first so that nested sources (e.g. process.argv
    // inside eval(process.argv[2])) are registered before we check the parent.
    ts.forEachChild(node, (child) => this.visit(child, sourceFile));

    // 1. Detect taint sources
    if (ts.isPropertyAccessExpression(node)) {
      const fullName = this.getPropertyAccessName(node);
      const sourceDef = isTaintSource(fullName);
      if (sourceDef) {
        const nodeId = this.nextNodeId();
        const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
        const location = this.getLocation(node);

        const taintNode: TaintNode = {
          id: nodeId,
          kind: "source",
          variableName: fullName,
          sourceFile: sourceFile.fileName,
          line: line + 1,
          column: character + 1,
          text: fullName,
        };

        this.graph.addNode(taintNode);

        // Mark the variable as tainted
        const symbol = this.checker.getSymbolAtLocation(node);
        const varName = symbol?.getName() ?? fullName;
        this.variableTaint.set(varName, {
          name: varName,
          tainted: true,
          source: sourceDef,
          declarations: [],
        });
      }
    }

    // 2. Detect taint sinks (function calls)
    if (ts.isCallExpression(node)) {
      const funcName = this.getCallName(node);
      const sinkDef = findTaintSink(funcName);

      if (sinkDef) {
        const nodeId = this.nextNodeId();
        const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
        const location = this.getLocation(node);

        // Check if any argument is tainted
        let isTainted = false;
        let sourceVar: string | undefined;

        for (const arg of node.arguments) {
          const argName = this.getSymbolName(arg);
          if (argName) {
            const varInfo = this.variableTaint.get(argName);
            if (varInfo?.tainted) {
              isTainted = true;
              sourceVar = argName;
              break;
            }
          }
        }

        const taintNode: TaintNode = {
          id: nodeId,
          kind: "sink",
          variableName: funcName,
          sourceFile: sourceFile.fileName,
          line: line + 1,
          column: character + 1,
          text: funcName,
        };

        this.graph.addNode(taintNode);

        // Create edge from variable to sink if tainted
        if (isTainted && sourceVar) {
          const sourceNode = this.graph.getNodes().find(
            (n) => (n.kind === "source" || n.kind === "assignment") && n.variableName === sourceVar,
          );
          if (sourceNode) {
            this.graph.addEdge({ from: sourceNode.id, to: nodeId, kind: "parameter" });
          }
        }
      }

      // 2b. Propagate taint to function parameters at call sites
      const signature = this.checker.getResolvedSignature(node);
      const declaration = signature?.getDeclaration();
      if (declaration && (ts.isFunctionDeclaration(declaration) || ts.isArrowFunction(declaration) || ts.isMethodDeclaration(declaration) || ts.isFunctionExpression(declaration))) {
        node.arguments.forEach((arg, index) => {
          const argName = this.getSymbolName(arg);
          const argInfo = argName ? this.variableTaint.get(argName) : undefined;
          if (argInfo?.tainted) {
            const param = declaration.parameters[index];
            if (param) {
              const paramName = param.name.getText();
              this.variableTaint.set(paramName, {
                name: paramName,
                tainted: true,
                source: argInfo.source,
                declarations: [param],
              });
            }
          }
        });
      }

      // 2c. Commander.js .action() callback — mark first param as tainted
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "action") {
        const callback = node.arguments[0];
        if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          const param = callback.parameters[0];
          if (param) {
            const paramName = param.name.getText();
            this.variableTaint.set(paramName, {
              name: paramName,
              tainted: true,
              source: { pattern: /^opts$/, kind: "parameter", description: "Commander .action() callback parameter" },
              declarations: [param],
            });
          }
        }
      }
    }

    // 3. Track variable assignments (x = taintedValue)
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const leftName = this.getSymbolName(node.left);
      const rightName = this.getSymbolName(node.right);

      if (leftName && rightName) {
        const rightInfo = this.variableTaint.get(rightName);
        if (rightInfo?.tainted) {
          const leftSymbol = this.checker.getSymbolAtLocation(node.left);
          const actualLeftName = leftSymbol?.getName() ?? leftName;

          this.variableTaint.set(actualLeftName, {
            name: actualLeftName,
            tainted: true,
            source: rightInfo.source,
            declarations: [],
          });

          // Add edge to graph
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

          // Find right-side node
          const rightNode = this.graph.getNodes().find(
            (n) => n.variableName === rightName && (n.kind === "source" || n.kind === "assignment"),
          );
          if (rightNode) {
            this.graph.addEdge({ from: rightNode.id, to: leftNodeId, kind: "assignment" });
          }
        }
      }
    }

    // 5. Track let/var reassignments
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const varName = this.getSymbolName(node.name);
      const initName = this.getSymbolName(node.initializer);

      if (varName && initName) {
        const initInfo = this.variableTaint.get(initName);
        if (initInfo?.tainted) {
          this.variableTaint.set(varName, {
            name: varName,
            tainted: true,
            source: initInfo.source,
            declarations: [node],
          });

          // Add node to graph
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

          const initNode = this.graph.getNodes().find(
            (n) => (n.kind === "source" || n.kind === "assignment") && n.variableName === initName,
          );
          if (initNode) {
            this.graph.addEdge({ from: initNode.id, to: nodeId, kind: "assignment" });
          }
        }
      }
    }
  }

  /** Run taint analysis on all source files */
  analyze(): TaintIssue[] {
    const issues: TaintIssue[] = [];
    const sourceFiles = this.program.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      if (sourceFile.isDeclarationFile) continue;
      if (!sourceFile.fileName.includes("node_modules")) {
        this.visit(sourceFile, sourceFile);
      }
    }

    // Find tainted sinks and create issues
    const nodes = this.graph.getNodes();
    const sinks = nodes.filter((n) => n.kind === "sink");

    for (const sink of nodes) {
      if (sink.kind !== "sink") continue;

      // Find source nodes that can reach this sink
      const reachers = this.graph.getReachers(sink.id, this.options.maxDepth);
      const sourceNodes = nodes.filter(
        (n) => n.kind === "source" && reachers.includes(n.id),
      );

      if (sourceNodes.length > 0) {
        const sinkDef = findTaintSink(sink.variableName ?? "");

        // Check if there are sanitizers on the path
        const pathNodes = this.graph.findPath(sourceNodes[0]?.id ?? "", sink.id);
        const hasSanitizer = pathNodes?.some((nodeId) => {
          const node = this.graph.getNode(nodeId);
          return node?.kind === "sanitizer" || (node?.variableName ? isSanitizer(node.variableName) !== undefined : false);
        }) ?? false;

        const issue: TaintIssue = {
          type: sinkDef?.issueType ?? "tainted_input",
          severity: sinkDef?.severity ?? 2,
          description: `Tainted data from ${sourceNodes.map((s) => s.variableName ?? s.text).join(", ")} reaches ${sinkDef?.description ?? sink.text} without sanitization`,
          location: sink.sourceFile.replace(this.options.projectRoot + "/", "") + ":" + sink.line,
          sourceType: sourceNodes[0]?.variableName ?? "unknown",
          sinkType: sinkDef?.name ?? "unknown",
          isSanitized: hasSanitizer,
          recommendation: `Sanitize input before using in ${sinkDef?.name ?? "sink function"}`,
        };

        if (issue.severity >= this.options.minSeverity) {
          issues.push(issue);
        }
      }
    }

    return issues;
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
