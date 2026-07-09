/**
 * Audit module — Compliance detectors
 *
 * Detectors that validate OWASP Top 10, CWE, SOC2, NIST, LGPD/GDPR,
 * data retention, consent tracking, encryption, access controls, and audit logging.
 * All analysis is deterministic — no LLM calls, no external APIs.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── OWASP Top 10 2025 Mapping ───────────────────────────────────────────────

import type { HealthIssueType } from "./types.js";

const OWASP_CATEGORIES: Record<string, HealthIssueType[]> = {
  "A01:BrokenAccessControl": [
    "missing_auth",
    "weak_access_controls",
    "missing_rate_limit",
  ],
  "A02:CryptographicFailures": [
    "weak_crypto",
    "missing_encryption",
    "hardcoded_secret",
  ],
  "A03:Injection": [
    "sql_injection",
    "xss_risk",
    "command_injection",
    "code_injection",
    "log_injection",
  ],
  "A04:InsecureDesign": [
    "missing_circuit_breaker",
    "missing_retry_policy",
    "missing_timeout",
  ],
  "A05:SecurityMisconfiguration": [
    "config_secrets",
    "insecure_http",
    "missing_health_check",
  ],
  "A06:VulnerableComponents": [
    "dependency_vulnerability",
    "deprecated_package",
    "transitive_vuln",
  ],
  "A07:AuthFailures": [
    "missing_auth",
    "weak_access_controls",
  ],
  "A08:DataIntegrityFailures": [
    "unsafe_deserialize",
    "missing_migration",
  ],
  "A09:LoggingFailures": [
    "missing_audit_log",
    "unstructured_logs",
    "missing_correlation_id",
  ],
  "A10:SSRF": [
    "ssrf",
    "open_redirect",
  ],
};

// ── 14.1 OWASP Top 10 Compliance ────────────────────────────────────────────

export function detectOWASPTop10(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const detectedTypes = new Set(existingIssues.map((i) => i.type));

  for (const [category, requiredTypes] of Object.entries(OWASP_CATEGORIES)) {
    const coveredCount = requiredTypes.filter((t) => detectedTypes.has(t)).length;
    const coverage = coveredCount / requiredTypes.length;

    if (coverage < 0.5 && existingIssues.length > 0) {
      issues.push({
        type: "owasp_gap",
        severity: 2,
        description: `OWASP ${category} com cobertura insuficiente (${Math.round(coverage * 100)}%)`,
        location: "compliance mapping",
        recommendation: `Rever controles de segurança para ${category}: ${requiredTypes.join(", ")}`,
      });
    }
  }

  return issues;
}

// ── 14.2 CWE Mapping ────────────────────────────────────────────────────────

const CWE_MAP: Record<string, string> = {
  "hardcoded_secret": "CWE-798",
  "sql_injection": "CWE-89",
  "xss_risk": "CWE-79",
  "command_injection": "CWE-78",
  "path_traversal": "CWE-22",
  "ssrf": "CWE-918",
  "open_redirect": "CWE-601",
  "weak_crypto": "CWE-327",
  "unsafe_eval": "CWE-95",
  "proto_pollution": "CWE-1321",
  "unsafe_deserialize": "CWE-502",
  "dependency_vulnerability": "CWE-1035",
  "regex_dos": "CWE-1333",
};

export function detectCWEMapping(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const detectedTypes = new Set(existingIssues.map((i) => i.type));

  const unmappedTypes = Array.from(detectedTypes).filter(
    (t) => !CWE_MAP[t] && t.includes("injection") || t.includes("secret") || t.includes("crypto"),
  );

  if (unmappedTypes.length > 0) {
    issues.push({
      type: "cwe_gap",
      severity: 1,
      description: `${unmappedTypes.length} tipos de issue sem mapeamento CWE`,
      location: "compliance mapping",
      recommendation: `Adicionar mapeamento CWE para: ${unmappedTypes.join(", ")}`,
    });
  }

  return issues;
}

// ── 14.3 SOC2 Controls ──────────────────────────────────────────────────────

const SOC2_CONTROL_FILES = [
  "ACCESS_CONTROL.md",
  "ENCRYPTION_POLICY.md",
  "LOGGING_POLICY.md",
  "MONITORING_POLICY.md",
  "INCIDENT_RESPONSE.md",
  "DATA_RETENTION.md",
];

export function detectSOC2Controls(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsDir = join(projectRoot, "nexus-system", "docs");

  const missingControls = SOC2_CONTROL_FILES.filter(
    (f) => !existsSync(join(docsDir, f)) && !existsSync(join(projectRoot, "docs", f)),
  );

  if (missingControls.length > 0) {
    issues.push({
      type: "soc2_gap",
      severity: 2,
      description: `SOC2: ${missingControls.length} documentos de controle em falta`,
      location: "compliance docs",
      recommendation: `Criar documentos de controle: ${missingControls.join(", ")}`,
    });
  }

  return issues;
}

// ── 14.4 NIST Alignment ─────────────────────────────────────────────────────

export function detectNISTAlignment(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const nexusDir = join(projectRoot, "nexus-system");

  const hasGovernance = existsSync(join(nexusDir, "governance"));
  const hasPolicies = existsSync(join(nexusDir, "governance", "policies"));
  const hasRules = existsSync(join(nexusDir, "governance", "rules"));

  if (!hasGovernance || !hasPolicies || !hasRules) {
    issues.push({
      type: "nist_gap",
      severity: 2,
      description: "NIST: Estrutura de governança incompleta",
      location: "nexus-system/governance",
      recommendation: "Implementar estrutura completa de governança conforme NIST SP 800-53",
    });
  }

  return issues;
}

// ── 14.5 LGPD Compliance ────────────────────────────────────────────────────

export function detectLGPDCompliance(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const lgpdPatterns = [
    /lgpd|lgpdd|lei.*geral.*dados/i,
    /gdpr|general.*data.*protection/i,
    /consent|consentimento/i,
    /retention|retenção|retencao/i,
    /titular|data.*subject/i,
    /dpo|data.*protection.*officer/i,
  ];

  const hasLGPD = files.some((f) =>
    lgpdPatterns.some((p) => p.test(f.content)),
  );

  if (!hasLGPD && files.length > 10) {
    issues.push({
      type: "lgpd_gap",
      severity: 2,
      description: "Nenhuma referência a LGPD/GDPR detectada no projeto",
      location: "project root",
      recommendation: "Documentar conformidade com LGPD: consentimento, retenção, direitos do titular, DPO.",
    });
  }

  return issues;
}

// ── 14.6 Data Retention ─────────────────────────────────────────────────────

export function detectDataRetention(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const retentionPatterns = [
    /retention|retenção|retencao|data.*retention/i,
    /delete.*after|remover.*após|expirar/i,
    /ttl|time.*to.*live|max.*age/i,
  ];

  const hasRetention = files.some((f) =>
    retentionPatterns.some((p) => p.test(f.content)),
  );

  if (!hasRetention && files.length > 10) {
    issues.push({
      type: "missing_retention_policy",
      severity: 2,
      description: "Nenhuma política de retenção de dados detectada",
      location: "project root",
      recommendation: "Definir e documentar políticas de retenção de dados conforme LGPD/GDPR.",
    });
  }

  return issues;
}

// ── 14.7 Consent Tracking ───────────────────────────────────────────────────

export function detectConsentTracking(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const consentPatterns = [
    /consent|consentimento|opt.*in|opt.*out/i,
    /cookie.*consent|privacy.*consent/i,
    /accept.*terms|aceitar.*termos/i,
  ];

  const hasConsent = files.some((f) =>
    consentPatterns.some((p) => p.test(f.content)),
  );

  if (!hasConsent && files.length > 10) {
    issues.push({
      type: "missing_consent",
      severity: 1,
      description: "Nenhum mecanismo de rastreamento de consentimento detectado",
      location: "project root",
      recommendation: "Implementar consent management para dados pessoais conforme LGPD/GDPR.",
    });
  }

  return issues;
}

// ── 14.8 Secrets in Config ──────────────────────────────────────────────────

export function detectSecretsInConfig(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const configFiles = [
    ".env",
    ".env.local",
    ".env.production",
    "config.json",
    "config.yml",
    "docker-compose.yml",
  ];

  const secretPatterns = [
    /password\s*[:=]\s*["'][^"']+["']/i,
    /secret\s*[:=]\s*["'][^"']+["']/i,
    /api_key\s*[:=]\s*["'][^"']+["']/i,
    /token\s*[:=]\s*["'][^"']+["']/i,
  ];

  for (const configFile of configFiles) {
    const configPath = join(projectRoot, configFile);
    if (!existsSync(configPath)) continue;

    const content = readFileSync(configPath, "utf-8");
    const hasSecret = secretPatterns.some((p) => p.test(content));

    if (hasSecret) {
      issues.push({
        type: "config_secrets",
        severity: 3,
        description: `Possível segredo detectado em ${configFile}`,
        location: configFile,
        recommendation: "Mover segredos para variáveis de ambiente ou vault. Nunca committar segredos em config files.",
      });
    }
  }

  return issues;
}

// ── 14.9 Encryption at Rest ─────────────────────────────────────────────────

export function detectEncryptionAtRest(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const encryptionPatterns = [
    /encrypt|decrypt|cipher|crypto/i,
    /aes|rsa|bcrypt|scrypt|argon/i,
    /hashed?|hash.*password/i,
  ];

  const sensitivePatterns = [
    /password|senha|secret|token|api.*key/i,
    /credit.*card|cpf|cnpj|ssn/i,
  ];

  const hasSensitiveData = files.some((f) =>
    sensitivePatterns.some((p) => p.test(f.content)),
  );

  const hasEncryption = files.some((f) =>
    encryptionPatterns.some((p) => p.test(f.content)),
  );

  if (hasSensitiveData && !hasEncryption) {
    issues.push({
      type: "missing_encryption",
      severity: 3,
      description: "Dados sensíveis detectados sem padrões de criptografia",
      location: "source files",
      recommendation: "Implementar criptografia para dados sensíveis em repouso e trânsito.",
    });
  }

  return issues;
}

// ── 14.10 Access Controls ───────────────────────────────────────────────────

export function detectAccessControls(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const authPatterns = [
    /@Auth|@UseGuards|@Roles|@Permissions/i,
    /authenticate|authorize|isAuthenticated/i,
    /middleware.*auth|auth.*middleware/i,
    /passport|jwt|bearer/i,
  ];

  const routePatterns = [
    /@(Get|Post|Put|Delete|Patch)\s*\(/i,
    /router\.(get|post|put|delete|patch)\s*\(/i,
    /app\.(get|post|put|delete|patch)\s*\(/i,
  ];

  const hasRoutes = files.some((f) =>
    routePatterns.some((p) => p.test(f.content)),
  );

  const hasAuth = files.some((f) =>
    authPatterns.some((p) => p.test(f.content)),
  );

  if (hasRoutes && !hasAuth) {
    issues.push({
      type: "weak_access_controls",
      severity: 3,
      description: "Rotas detectadas sem middleware de autORIZAÇÃO/autENTICAÇÃO",
      location: "source files",
      recommendation: "Implementar middleware de auth para todas as rotas sensíveis.",
    });
  }

  return issues;
}

// ── 14.11 Audit Logging ─────────────────────────────────────────────────────

export function detectAuditLogging(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const auditPatterns = [
    /audit.*log|log.*audit/i,
    /activity.*log|log.*activity/i,
    /security.*event|event.*security/i,
    /createLog|logEvent|recordEvent/i,
  ];

  const hasAuditLog = files.some((f) =>
    auditPatterns.some((p) => p.test(f.content)),
  );

  if (!hasAuditLog && files.length > 10) {
    issues.push({
      type: "missing_audit_log",
      severity: 2,
      description: "Nenhum padrão de audit logging detectado",
      location: "source files",
      recommendation: "Implementar audit logging para ações sensíveis: create, update, delete, login.",
    });
  }

  return issues;
}

// ── 14.12 Compliance Report ─────────────────────────────────────────────────

export function detectComplianceReport(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const compliancePaths = [
    join(projectRoot, "docs", "COMPLIANCE.md"),
    join(projectRoot, "docs", "compliance"),
    join(projectRoot, "nexus-system", "docs", "COMPLIANCE.md"),
    join(projectRoot, "nexus-system", "docs", "compliance"),
  ];

  const hasComplianceReport = compliancePaths.some((p) => existsSync(p));

  if (!hasComplianceReport) {
    issues.push({
      type: "missing_compliance_report",
      severity: 1,
      description: "Nenhum relatório de compliance encontrado",
      location: "project root",
      recommendation: "Criar relatório de compliance mapeando controles para frameworks (OWASP, SOC2, NIST).",
    });
  }

  return issues;
}
