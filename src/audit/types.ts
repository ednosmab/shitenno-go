/**
 * Audit module — Type definitions
 *
 * All shared types for the health audit system.
 */

/** Source file metadata collected during project scan. */
export interface SourceFileInfo {
  fullPath: string;
  relPath: string;
  basename: string;
  content: string;
  lineCount: number;
}

/** History entry read from nexus-system/docs/history/*.md. */
export interface HistoryEntry {
  filename: string;
  date: string;
  content: string;
}

/** Nível de auditoria — controla quais detectors são executados. */
export type AuditLevel = "quick" | "standard" | "full" | "code-review";

/** Problema de saúde detectado no sistema. */
export interface HealthIssue {
  type:
    | "dead_rule"
    | "violation_hotspot"
    | "missing_docs"
    | "orphan_dir"
    | "stale_buffer"
    | "date_placeholder"
    | "empty_dir"
    | "broken_ref"
    | "missing_gitignore"
    | "maturity_inconsistency"
    | "adr_coverage_gap"
    | "missing_package_json"
    | "bare_word_ref"
    | "template_dir_ref"
    | "extension_mismatch"
    | "system_map_mismatch"
    | "broken_command"
    | "p0_inconsistency"
    | "triple_maturity_score"
    | "empty_stack"
    | "script_wiring"
    | "agent_contract_ref"
    | "buffer_schema_mismatch"
    | "rule_typo"
    | "numbering_gap"
    | "doc_count_mismatch"
    | "cross_doc_p0_contradiction"
    | "empty_data_file"
    | "phantom_rule_ref"
    | "test_failure"
    | "orphan_module"
    | "oversized_file"
    | "lint_error"
    | "missing_test"
    | "any_type_usage"
    | "type_error"
    | "console_log_outside_cmd"
    | "empty_catch"
    | "circular_dep"
    | "high_complexity"
    | "unused_export"
    | "dead_code"
    | "unpinned_version"
    | "missing_lock_file"
    | "lock_file_drift"
    | "phantom_dep"
    | "deprecated_package"
    // Taint analysis types
    | "tainted_input"
    | "open_redirect"
    | "ssrf"
    | "log_injection"
    | "code_injection"
    | "command_injection"
    | "path_traversal"
    | "sql_injection"
    | "xss_risk"
    // Security pattern types (SEC-*)
    | "hardcoded_secret"
    | "unsafe_eval"
    | "console_secret"
    | "weak_crypto"
    | "insecure_http"
    | "proto_pollution"
    | "regex_dos"
    | "unsafe_deserialize"
    | "dep_confusion"
    // New detectors (Fase 5)
    | "dependency_vulnerability"
    | "incompatible_license"
    | "config_secret"
    // Git Intelligence (Fase 6)
    | "commit_format_violation"
    | "branch_naming_violation"
    | "direct_main_commits"
    | "force_push_detected"
    | "orphan_branches"
    | "non_english_commit"
    | "secret_in_git_history"
    | "missing_quality_gates"
    // Governance Enforcement (Fase 6)
    | "session_not_closed"
    | "buffer_not_pruned"
    | "missing_feedback_dir"
    | "no_feedback_records"
    | "invalid_backlog_state"
    | "plan_format_violation"
    | "invalid_rule_structure"
    | "malformed_rule_json"
    | "missing_policies_dir"
    | "missing_policy"
    | "missing_premortem"
    | "no_adrs_created"
    // Code Quality Intelligence (Fase 6)
    | "missing_jsdoc"
    | "unsafe_type_assertion"
    | "unreachable_code"
    | "unused_import"
    | "magic_numbers"
    | "long_params"
    | "deep_nesting"
    | "duplicate_code"
    | "god_function"
    | "low_coverage_threshold"
    // Architecture Validation (Fase 6)
    | "layer_violation"
    | "srp_violation"
    | "dip_violation"
    | "barrel_file_bloat"
    | "high_coupling"
    | "import_order_violation"
    | "flat_test_structure";
  severity: 1 | 2 | 3;
  description: string;
  location: string;
  recommendation: string;
}

/** Sugestão de optimização de governança. */
export interface GovernanceOptimization {
  id: string;
  title: string;
  description: string;
  action:
    | "remove_rule"
    | "rewrite_rule"
    | "promote_to_lint"
    | "add_docs"
    | "fix_dates"
    | "populate_dir"
    | "fix_refs"
    | "add_gitignore"
    | "reconcile_scores"
    | "create_adr"
    | "create_package_json"
    | "fix_bare_refs"
    | "fix_template_dirs"
    | "fix_extensions"
    | "reconcile_system_map"
    | "fix_commands"
    | "reconcile_p0"
    | "fix_triple_score"
    | "fix_stack"
    | "wire_scripts"
    | "fix_contract_refs"
    | "fix_buffer_schema"
    | "fix_typos"
    | "fix_numbering"
    | "fix_doc_counts"
    | "reconcile_p0_cross_doc"
    | "fix_empty_files"
    | "fix_phantom_rule_refs"
    | "add_test"
    | "split_module"
    | "fix_lint"
    | "add_type"
    | "remove_console_log"
    | "fix_empty_catch"
    | "break_cycle"
    | "reduce_complexity"
    | "remove_unused_export"
    | "remove_dead_code"
    | "pin_version"
    | "add_lock_file"
    | "sync_lock_file"
    | "add_missing_dep"
    | "replace_deprecated"
    // Taint analysis actions
    | "sanitize_input"
    | "fix_taint_flow";
  affectedRule: string;
  evidence: string[];
}

/** Relatório completo de auditoria de saúde. */
export interface HealthAuditReport {
  auditedAt: string;
  totalRules: number;
  historyEntries: number;
  sessionsAnalyzed: number;
  issues: HealthIssue[];
  optimizations: GovernanceOptimization[];
  healthScore: number;
  summary: string;
  level: AuditLevel;
}
