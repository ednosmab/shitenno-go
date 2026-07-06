/**
 * Audit module — Optimization proposer
 *
 * Generates governance optimization proposals from detected issues.
 */

import type { HealthIssue, GovernanceOptimization } from "./types.js";

/**
 * Propose governance optimizations based on detected health issues.
 */
export function proposeOptimizations(issues: HealthIssue[]): GovernanceOptimization[] {
  const optimizations: GovernanceOptimization[] = [];
  let optId = 1;

  for (const issue of issues) {
    if (issue.type === "dead_rule") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover regra morta",
        description: issue.description,
        action: "remove_rule",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "violation_hotspot") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reescrever ou automatizar regra",
        description: issue.description,
        action: issue.severity === 3 ? "promote_to_lint" : "rewrite_rule",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "orphan_dir") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Popular directório órfão",
        description: issue.description,
        action: "add_docs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "date_placeholder") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar datas placeholder",
        description: issue.description,
        action: "fix_dates",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "empty_dir") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Popular directório vazio",
        description: issue.description,
        action: "populate_dir",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "broken_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir referência quebrada",
        description: issue.description,
        action: "fix_refs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "missing_gitignore") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Criar .gitignore",
        description: issue.description,
        action: "add_gitignore",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "maturity_inconsistency") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reconciliar scores de maturidade",
        description: issue.description,
        action: "reconcile_scores",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "adr_coverage_gap") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Criar ADRs em falta",
        description: issue.description,
        action: "create_adr",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "missing_package_json") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Criar package.json",
        description: issue.description,
        action: "create_package_json",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "bare_word_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir referência bare-word",
        description: issue.description,
        action: "fix_bare_refs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "template_dir_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Criar directório de template",
        description: issue.description,
        action: "fix_template_dirs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "extension_mismatch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir extensão de referência",
        description: issue.description,
        action: "fix_extensions",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "system_map_mismatch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar SYSTEM_MAP.md",
        description: issue.description,
        action: "reconcile_system_map",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "broken_command") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Tornar comandos executáveis",
        description: issue.description,
        action: "fix_commands",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "p0_inconsistency") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reconciliar listas P0",
        description: issue.description,
        action: "reconcile_p0",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "triple_maturity_score") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reconciliar scores de maturidade (3 fontes)",
        description: issue.description,
        action: "fix_triple_score",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "empty_stack") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Preencher stack em fingerprint.json",
        description: issue.description,
        action: "fix_stack",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "script_wiring") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar script em falta ao package.json",
        description: issue.description,
        action: "wire_scripts",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "agent_contract_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir referência em contrato de agente",
        description: issue.description,
        action: "fix_contract_refs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "buffer_schema_mismatch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar secções em falta ao buffer",
        description: issue.description,
        action: "fix_buffer_schema",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "rule_typo") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir typo em regra",
        description: issue.description,
        action: "fix_typos",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "numbering_gap") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir gap de numeração",
        description: issue.description,
        action: "fix_numbering",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "doc_count_mismatch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar contagens na documentação",
        description: issue.description,
        action: "fix_doc_counts",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "cross_doc_p0_contradiction") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reconciliar listas P0 entre documentos",
        description: issue.description,
        action: "reconcile_p0_cross_doc",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "empty_data_file") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Popular ficheiro de dados vazio",
        description: issue.description,
        action: "fix_empty_files",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "phantom_rule_ref") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir referência a regra inexistente",
        description: issue.description,
        action: "fix_phantom_rule_refs",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "test_failure") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir testes falhados",
        description: issue.description,
        action: "add_test",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "orphan_module") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover ou conectar módulo órfão",
        description: issue.description,
        action: "remove_rule",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "oversized_file") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Dividir arquivo oversized",
        description: issue.description,
        action: "split_module",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "missing_test") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar teste em falta",
        description: issue.description,
        action: "add_test",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "lint_error") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir erros ESLint",
        description: issue.description,
        action: "fix_lint",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "any_type_usage") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Substituir tipos any",
        description: issue.description,
        action: "add_type",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "type_error") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir erros de tipo TypeScript",
        description: issue.description,
        action: "add_type",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "console_log_outside_cmd") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Substituir console.log por logger",
        description: issue.description,
        action: "remove_console_log",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "empty_catch") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar tratamento de erro",
        description: issue.description,
        action: "fix_empty_catch",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "circular_dep") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Quebrar dependência circular",
        description: issue.description,
        action: "break_cycle",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "high_complexity") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Reduzir complexidade",
        description: issue.description,
        action: "reduce_complexity",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "unused_export") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover export não usado",
        description: issue.description,
        action: "remove_unused_export",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "dead_code") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover código morto",
        description: issue.description,
        action: "remove_dead_code",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "unpinned_version") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Fixar versões de dependências",
        description: issue.description,
        action: "pin_version",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "missing_lock_file") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Gerar lock file",
        description: issue.description,
        action: "add_lock_file",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "lock_file_drift") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar lock file",
        description: issue.description,
        action: "sync_lock_file",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "phantom_dep") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Adicionar dependência em falta",
        description: issue.description,
        action: "add_missing_dep",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "deprecated_package") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Substituir dependência deprecated",
        description: issue.description,
        action: "replace_deprecated",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "hardcoded_secret") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Mover secrets para variaveis de ambiente",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "sql_injection") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Usar prepared statements",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "xss_risk") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Sanitizar input HTML",
        description: issue.description,
        action: "sanitize_input",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "unsafe_eval") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover eval/Function dinamicos",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "console_secret") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Remover dados sensiveis dos logs",
        description: issue.description,
        action: "remove_console_log",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "weak_crypto") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Actualizar criptografia",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "insecure_http") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Migrar para HTTPS",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "proto_pollution") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Validar input em merges",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "regex_dos") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Simplificar regex complexos",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "unsafe_deserialize") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Validar JSON com schema",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "dep_confusion") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir dependencia em falta",
        description: issue.description,
        action: "add_missing_dep",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "path_traversal") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Sanitizar caminhos de ficheiro",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "tainted_input") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Sanitizar input",
        description: issue.description,
        action: "sanitize_input",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "code_injection" || issue.type === "command_injection") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Corrigir fluxo de taint",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "open_redirect") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Validar URL de redirect",
        description: issue.description,
        action: "fix_taint_flow",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
    if (issue.type === "log_injection") {
      optimizations.push({
        id: `OPT-${String(optId++).padStart(3, "0")}`,
        title: "Sanitizar log input",
        description: issue.description,
        action: "sanitize_input",
        affectedRule: issue.location,
        evidence: [issue.recommendation],
      });
    }
  }

  return optimizations;
}
