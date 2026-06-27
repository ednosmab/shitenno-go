/**
 * PROJECT PROFILE — Configuração específica do projecto para o Nexus System.
 *
 * Este ficheiro é gerado automaticamente pelo `nexus init`.
 * Revise os valores detectados e ajuste conforme necessário.
 *
 * Este profile alimenta o motor de complexidade (core/complexity/)
 * e os contratos de agente (governance/agents/).
 */

import type { ProjectProfile } from "../core/complexity/types";

export const profile: ProjectProfile = {
  /** Nome legível do projecto (detectado de package.json). */
  projectName: "[PROJECT_NAME]",

  /** Áreas físicas reais do projecto a serem medidas. */
  areas: [
    // Detectadas automaticamente pelo nexus init
    // ex: "packages/core", "packages/ui", "apps/admin"
    "[AREAS]",
  ],

  /** Palavras-chave que indicam superfície sensível. */
  sensitiveKeywords: [
    "auth",
    "rls",
    "jwt",
    "payment",
    "session",
    "security",
  ],

  /** Janela de dias para cálculo de churn. */
  churnWindowDays: 90,

  /** Peso relativo de cada sinal na composição do score. */
  weights: {
    churn: 1.0,
    violationRate: 1.0,
    sensitiveSurface: 1.0,
  },

  /** Caminho para o histórico de sessões. */
  historyPath: "nexus-system/docs/history",

  /** Vocabulário de incidente específico do domínio. */
  violationKeywords: [
    "erro",
    "bug",
    "corrigi",
    "falhou",
    "rollback",
  ],

  // --- Campos opcionais (preenchidos se o projecto adotar governance completa) ---

  /** Caminho para regras proibidas. */
  // forbiddenOperationsPath: "nexus-system/docs/FORBIDDEN_OPERATIONS.md",

  /** Caminho para handoffs. */
  // handoffsPath: "nexus-system/governance/handoffs",

  /** Score a partir do qual PREMORTEM é obrigatório. */
  // highComplexityThreshold: 7,

  /** Caminho para SDRs. */
  // sdrPath: "nexus-system/docs/sdr",

  /** Caminho para feedback diário. */
  // feedbackPath: "nexus-system/docs/feedback",
};
