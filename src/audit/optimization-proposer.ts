/**
 * Audit module — Optimization proposer (handler-record pattern)
 *
 * Generates governance optimization proposals from detected issues.
 */

import type { HealthIssue, GovernanceOptimization } from "./types.js";

// ── Types ──────────────────────────────────────────────────────────────────

interface HandlerEntry {
  title: string;
  action: string;
  overrideAction?: (issue: HealthIssue) => string;
}

// ── Handler record (maps issue.type → config) ──────────────────────────────

const HANDLER_MAP: Record<string, HandlerEntry> = {
  dead_rule:                    { title: "Remover regra morta",                          action: "remove_rule" },
  violation_hotspot:            { title: "Reescrever ou automatizar regra",              action: "rewrite_rule",
    overrideAction: (i) => i.severity === 3 ? "promote_to_lint" : "rewrite_rule" },
  orphan_dir:                   { title: "Popular directório órfão",                     action: "add_docs" },
  date_placeholder:             { title: "Actualizar datas placeholder",                 action: "fix_dates" },
  empty_dir:                    { title: "Popular directório vazio",                     action: "populate_dir" },
  broken_ref:                   { title: "Corrigir referência quebrada",                 action: "fix_refs" },
  missing_gitignore:            { title: "Criar .gitignore",                             action: "add_gitignore" },
  maturity_inconsistency:       { title: "Reconciliar scores de maturidade",             action: "reconcile_scores" },
  adr_coverage_gap:             { title: "Criar ADRs em falta",                          action: "create_adr" },
  missing_package_json:         { title: "Criar package.json",                           action: "create_package_json" },
  bare_word_ref:                { title: "Corrigir referência bare-word",                action: "fix_bare_refs" },
  template_dir_ref:             { title: "Criar directório de template",                 action: "fix_template_dirs" },
  extension_mismatch:           { title: "Corrigir extensão de referência",              action: "fix_extensions" },
  system_map_mismatch:          { title: "Actualizar SYSTEM_MAP.md",                     action: "reconcile_system_map" },
  broken_command:               { title: "Tornar comandos executáveis",                  action: "fix_commands" },
  p0_inconsistency:             { title: "Reconciliar listas P0",                        action: "reconcile_p0" },
  triple_maturity_score:        { title: "Reconciliar scores de maturidade (3 fontes)",  action: "fix_triple_score" },
  empty_stack:                  { title: "Preencher stack em fingerprint.json",          action: "fix_stack" },
  script_wiring:                { title: "Adicionar script em falta ao package.json",    action: "wire_scripts" },
  agent_contract_ref:           { title: "Corrigir referência em contrato de agente",    action: "fix_contract_refs" },
  buffer_schema_mismatch:       { title: "Adicionar secções em falta ao buffer",         action: "fix_buffer_schema" },
  rule_typo:                    { title: "Corrigir typo em regra",                       action: "fix_typos" },
  numbering_gap:                { title: "Corrigir gap de numeração",                    action: "fix_numbering" },
  doc_count_mismatch:           { title: "Actualizar contagens na documentação",         action: "fix_doc_counts" },
  cross_doc_p0_contradiction:   { title: "Reconciliar listas P0 entre documentos",      action: "reconcile_p0_cross_doc" },
  empty_data_file:              { title: "Popular ficheiro de dados vazio",              action: "fix_empty_files" },
  phantom_rule_ref:             { title: "Corrigir referência a regra inexistente",      action: "fix_phantom_rule_refs" },
  test_failure:                 { title: "Corrigir testes falhados",                     action: "add_test" },
  orphan_module:                { title: "Remover ou conectar módulo órfão",             action: "remove_rule" },
  oversized_file:               { title: "Dividir arquivo oversized",                    action: "split_module" },
  missing_test:                 { title: "Adicionar teste em falta",                     action: "add_test" },
  lint_error:                   { title: "Corrigir erros ESLint",                        action: "fix_lint" },
  any_type_usage:               { title: "Substituir tipos any",                         action: "add_type" },
  type_error:                   { title: "Corrigir erros de tipo TypeScript",            action: "add_type" },
  console_log_outside_cmd:      { title: "Substituir console.log por logger",            action: "remove_console_log" },
  empty_catch:                  { title: "Adicionar tratamento de erro",                 action: "fix_empty_catch" },
  circular_dep:                 { title: "Quebrar dependência circular",                 action: "break_cycle" },
  high_complexity:              { title: "Reduzir complexidade",                         action: "reduce_complexity" },
  unused_export:                { title: "Remover export não usado",                     action: "remove_unused_export" },
  dead_code:                    { title: "Remover código morto",                         action: "remove_dead_code" },
  unpinned_version:             { title: "Fixar versões de dependências",                action: "pin_version" },
  missing_lock_file:            { title: "Gerar lock file",                              action: "add_lock_file" },
  lock_file_drift:              { title: "Actualizar lock file",                         action: "sync_lock_file" },
  phantom_dep:                  { title: "Adicionar dependência em falta",               action: "add_missing_dep" },
  deprecated_package:           { title: "Substituir dependência deprecated",            action: "replace_deprecated" },
  hardcoded_secret:             { title: "Mover secrets para variaveis de ambiente",     action: "fix_taint_flow" },
  sql_injection:                { title: "Usar prepared statements",                     action: "fix_taint_flow" },
  xss_risk:                     { title: "Sanitizar input HTML",                         action: "sanitize_input" },
  unsafe_eval:                  { title: "Remover eval/Function dinamicos",              action: "fix_taint_flow" },
  console_secret:               { title: "Remover dados sensiveis dos logs",             action: "remove_console_log" },
  weak_crypto:                  { title: "Actualizar criptografia",                      action: "fix_taint_flow" },
  insecure_http:                { title: "Migrar para HTTPS",                            action: "fix_taint_flow" },
  proto_pollution:              { title: "Validar input em merges",                      action: "fix_taint_flow" },
  regex_dos:                    { title: "Simplificar regex complexos",                  action: "fix_taint_flow" },
  unsafe_deserialize:           { title: "Validar JSON com schema",                      action: "fix_taint_flow" },
  dep_confusion:                { title: "Corrigir dependencia em falta",                action: "add_missing_dep" },
  path_traversal:               { title: "Sanitizar caminhos de ficheiro",              action: "fix_taint_flow" },
  tainted_input:                { title: "Sanitizar input",                              action: "sanitize_input" },
  code_injection:               { title: "Corrigir fluxo de taint",                      action: "fix_taint_flow" },
  command_injection:            { title: "Corrigir fluxo de taint",                      action: "fix_taint_flow" },
  open_redirect:                { title: "Validar URL de redirect",                      action: "fix_taint_flow" },
  log_injection:                { title: "Sanitizar log input",                          action: "sanitize_input" },
};

// ── Core ───────────────────────────────────────────────────────────────────

function buildOptimization(
  entry: HandlerEntry,
  issue: HealthIssue,
  id: string,
): GovernanceOptimization {
  return {
    id,
    title: entry.title,
    description: issue.description,
    action: (entry.overrideAction ? entry.overrideAction(issue) : entry.action) as GovernanceOptimization["action"],
    affectedRule: issue.location,
    evidence: [issue.recommendation],
  };
}

export function proposeOptimizations(issues: HealthIssue[]): GovernanceOptimization[] {
  const optimizations: GovernanceOptimization[] = [];
  let optId = 1;

  for (const issue of issues) {
    const entry = HANDLER_MAP[issue.type];
    if (!entry) continue;
    optimizations.push(buildOptimization(entry, issue, `OPT-${String(optId++).padStart(3, "0")}`));
  }

  return optimizations;
}
