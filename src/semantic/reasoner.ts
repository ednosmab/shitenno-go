/**
 * reasoner.ts — Semantic Reasoning Engine
 *
 * Analyzes semantic patterns together with engineering state, risk map,
 * knowledge graph, and maturity profile to generate higher-level insights.
 * Connects signals across subsystems to produce actionable intelligence.
 *
 * PRINCIPLE: Reasoning is deterministic and explainable — every insight
 * can be traced back to specific evidence from multiple subsystems.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { SemanticDomain } from "./taxonomy.js";
import type { DetectedPattern } from "./pattern-rules.js";
import type { ChangeJournal } from "./change-journal.js";

// ── Types ───────────────────────────────────────────────────────────────────

export type InsightType =
  | "architecture_evolution"
  | "security_posture_change"
  | "scope_expansion"
  | "maturity_mismatch"
  | "debt_accumulation"
  | "governance_gap"
  | "cross_system_correlation";

export interface SemanticInsight {
  id: string;
  type: InsightType;
  domains: SemanticDomain[];
  description: string;
  confidence: number;
  evidence: Evidence[];
  suggestedActions: string[];
  priority: "urgent" | "high" | "medium" | "low";
  detectedAt: string;
  sourcePatterns: string[];
}

export interface Evidence {
  source: "pattern" | "risk" | "maturity" | "knowledge" | "journal" | "health";
  description: string;
  data: Record<string, unknown>;
}

export interface ReasonerContext {
  shitennoDir: string;
  projectRoot: string;
  patterns: DetectedPattern[];
  journal: ChangeJournal;
}

// ── Insight Rules ───────────────────────────────────────────────────────────

interface InsightRule {
  type: InsightType;
  name: string;
  condition: (ctx: ReasonerContext, evidence: Evidence[]) => SemanticInsight | null;
}

const INSIGHT_RULES: InsightRule[] = [
  // ── Architecture Evolution ────────────────────────────────────────────
  {
    type: "architecture_evolution",
    name: "Evolução Arquitetural",
    condition: (ctx, evidence) => {
      const archPatterns = ctx.patterns.filter((p) => p.type === "architectural_shift");
      if (archPatterns.length === 0) return null;

      const domains = [...new Set(archPatterns.map((p) => p.domain))];
      const avgConfidence = archPatterns.reduce((sum, p) => sum + p.confidence, 0) / archPatterns.length;

      return {
        id: `ae-${Date.now()}`,
        type: "architecture_evolution",
        domains: domains as SemanticDomain[],
        description: `${archPatterns.length} mudança(s) arquitetural(is) detectada(s) em: ${domains.join(", ")}`,
        confidence: avgConfidence,
        evidence,
        suggestedActions: [
          "Documentar decisões arquiteturais como ADRs",
          "Rever coerência entre domínios afectados",
          "Avaliar impacto em testes e documentação",
        ],
        priority: archPatterns.length >= 2 ? "high" : "medium",
        detectedAt: new Date().toISOString(),
        sourcePatterns: archPatterns.map((p) => p.id),
      };
    },
  },

  // ── Security Posture Change ───────────────────────────────────────────
  {
    type: "security_posture_change",
    name: "Mudança de Postura de Segurança",
    condition: (ctx, evidence) => {
      const secPatterns = ctx.patterns.filter(
        (p) => p.type === "security_degradation" || p.domain === "security"
      );
      if (secPatterns.length === 0) return null;

      const hasHighRisk = evidence.some(
        (e) => e.source === "risk" && (e.data.level === "high" || e.data.level === "critical")
      );

      return {
        id: `spc-${Date.now()}`,
        type: "security_posture_change",
        domains: ["security", "authentication"],
        description: `Postura de segurança alterada — ${secPatterns.length} padrão(ões) com ${hasHighRisk ? "risco elevado" : "sinais de degradação"}`,
        confidence: Math.min(secPatterns.reduce((sum, p) => sum + p.confidence, 0) / secPatterns.length + (hasHighRisk ? 0.1 : 0), 1),
        evidence,
        suggestedActions: [
          "Executar audit de segurança",
          "Rever dependências vulneráveis",
          "Verificar testes de segurança",
        ],
        priority: hasHighRisk ? "urgent" : "high",
        detectedAt: new Date().toISOString(),
        sourcePatterns: secPatterns.map((p) => p.id),
      };
    },
  },

  // ── Scope Expansion ──────────────────────────────────────────────────
  {
    type: "scope_expansion",
    name: "Expansão de Escopo",
    condition: (ctx, evidence) => {
      const driftPatterns = ctx.patterns.filter((p) => p.type === "scope_drift");
      if (driftPatterns.length === 0) return null;

      const domains = driftPatterns.flatMap((p) => p.domains);

      return {
        id: `se-${Date.now()}`,
        type: "scope_expansion",
        domains: domains as SemanticDomain[],
        description: `Escopo do projecto a expandir — ${driftPatterns.length} domínio(s) novo(s) detectado(s)`,
        confidence: driftPatterns[0]?.confidence ?? 0.5,
        evidence,
        suggestedActions: [
          "Rever limites de domínio do projecto",
          "Avaliar se novos módulos são necessários",
          "Documentar mudanças de escopo",
        ],
        priority: "medium",
        detectedAt: new Date().toISOString(),
        sourcePatterns: driftPatterns.map((p) => p.id),
      };
    },
  },

  // ── Maturity Mismatch ────────────────────────────────────────────────
  {
    type: "maturity_mismatch",
    name: "Incompatibilidade de Maturidade",
    condition: (_ctx, evidence) => {
      const maturityEvidence = evidence.filter((e) => e.source === "maturity");
      if (maturityEvidence.length === 0) return null;

      const lowMaturity = maturityEvidence.filter((e) => {
        const score = e.data.score as number;
        return score !== undefined && score < 40;
      });

      if (lowMaturity.length === 0) return null;

      const domains = lowMaturity.map((e) => e.data.domain as string).filter(Boolean);

      return {
        id: `mm-${Date.now()}`,
        type: "maturity_mismatch",
        domains: domains as SemanticDomain[],
        description: `Maturidade baixa em ${lowMaturity.length} dimensão(ões): ${domains.join(", ")}`,
        confidence: 0.7,
        evidence,
        suggestedActions: [
          "Melhorar capabilities nas dimensões baixas",
          "Adicionar testes e documentação",
          "Considerar upgrade de maturidade",
        ],
        priority: "high",
        detectedAt: new Date().toISOString(),
        sourcePatterns: [],
      };
    },
  },

  // ── Debt Accumulation ────────────────────────────────────────────────
  {
    type: "debt_accumulation",
    name: "Acumulação de Dívida",
    condition: (ctx, evidence) => {
      const debtPatterns = ctx.patterns.filter((p) => p.type === "tech_debt_accumulation");
      if (debtPatterns.length === 0) return null;

      const healthEvidence = evidence.filter((e) => e.source === "health");
      const lowHealth = healthEvidence.some((e) => {
        const score = e.data.score as number;
        return score !== undefined && score < 50;
      });

      return {
        id: `da-${Date.now()}`,
        type: "debt_accumulation",
        domains: debtPatterns[0]?.domains as SemanticDomain[] ?? ["governance"],
        description: `Dívida técnica a acumular — ${lowHealth ? "saúde do conhecimento baixa" : "padrões de degradação detectados"}`,
        confidence: debtPatterns[0]?.confidence ?? 0.5,
        evidence,
        suggestedActions: [
          "Dedicar sprint de qualidade",
          "Rever e actualizar documentação",
          "Adicionar testes para código não testado",
        ],
        priority: lowHealth ? "high" : "medium",
        detectedAt: new Date().toISOString(),
        sourcePatterns: debtPatterns.map((p) => p.id),
      };
    },
  },

  // ── Governance Gap ───────────────────────────────────────────────────
  {
    type: "governance_gap",
    name: "Gap de Governance",
    condition: (ctx, evidence) => {
      const capGaps = ctx.patterns.filter((p) => p.type === "capability_gap");
      if (capGaps.length === 0) return null;

      const domains = capGaps.map((p) => p.domain);

      return {
        id: `gg-${Date.now()}`,
        type: "governance_gap",
        domains: domains as SemanticDomain[],
        description: `Gaps de governance em: ${domains.join(", ")}`,
        confidence: capGaps.reduce((sum, p) => sum + p.confidence, 0) / capGaps.length,
        evidence,
        suggestedActions: [
          "Instalar capabilities necessárias",
          "Rever maturidade do projecto",
          "Executar shugo audit",
        ],
        priority: "medium",
        detectedAt: new Date().toISOString(),
        sourcePatterns: capGaps.map((p) => p.id),
      };
    },
  },
];

// ── Reasoner Implementation ─────────────────────────────────────────────────

export class SemanticReasoner {
  private ctx: ReasonerContext;

  constructor(ctx: ReasonerContext) {
    this.ctx = ctx;
  }

  /** Generate all applicable insights from current state. */
  reason(): SemanticInsight[] {
    const evidence = this.collectEvidence();
    const insights: SemanticInsight[] = [];

    for (const rule of INSIGHT_RULES) {
      try {
        const insight = rule.condition(this.ctx, evidence);
        if (insight) {
          insights.push(insight);
        }
      } catch (err) {
        logger.warn("semantic-reasoner", `Error in rule "${rule.name}": ${err}`);
      }
    }

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return insights;
  }

  private collectJsonEvidence(evidence: Evidence[], source: Evidence["source"], relPath: string): void {
    try {
      const fullPath = join(this.ctx.shitennoDir, relPath);
      if (!existsSync(fullPath)) return;
      const raw = JSON.parse(readFileSync(fullPath, "utf-8")) as Record<string, unknown>;
      if (source === "risk") {
        evidence.push({ source, description: `Risk map: ${raw.overallRisk ?? "unknown"} (${raw.overallScore ?? 0})`, data: { level: raw.overallRisk ?? "unknown", score: raw.overallScore ?? 0 } });
      } else {
        evidence.push({ source, description: `Health score: ${raw.score ?? "unknown"}`, data: { score: raw.score ?? 0 } });
      }
    } catch { /* file may not exist */ }
  }

  private collectMaturityEvidence(evidence: Evidence[]): void {
    try {
      const p = join(this.ctx.shitennoDir, "governance", "maturity-profile.json");
      if (!existsSync(p)) return;
      const m = JSON.parse(readFileSync(p, "utf-8")) as { dimensions?: Record<string, { score?: number }> };
      if (!m.dimensions) return;
      for (const [domain, dim] of Object.entries(m.dimensions)) {
        evidence.push({ source: "maturity", description: `Maturity ${domain}: ${dim.score ?? 0}`, data: { domain, score: dim.score ?? 0 } });
      }
    } catch { /* file may not exist */ }
  }

  private collectJournalEvidence(evidence: Evidence[]): void {
    const entries = this.ctx.journal.query({ limit: 20 });
    if (entries.length === 0) return;
    const domainCounts: Record<string, number> = {};
    for (const e of entries) { domainCounts[e.classification.domain] = (domainCounts[e.classification.domain] ?? 0) + 1; }
    evidence.push({ source: "journal", description: `${entries.length} entries across ${Object.keys(domainCounts).length} domains`, data: { entryCount: entries.length, domains: domainCounts } });
  }

  private collectPatternEvidence(evidence: Evidence[]): void {
    for (const p of this.ctx.patterns) {
      evidence.push({ source: "pattern", description: `Pattern: ${p.type} in ${p.domain}`, data: { patternType: p.type, domain: p.domain, confidence: p.confidence } });
    }
  }

  /** Collect evidence from multiple subsystems. */
  private collectEvidence(): Evidence[] {
    const evidence: Evidence[] = [];
    this.collectPatternEvidence(evidence);
    this.collectJournalEvidence(evidence);
    this.collectJsonEvidence(evidence, "risk", "governance/risk-map.json");
    this.collectJsonEvidence(evidence, "health", "governance/health-score.json");
    this.collectMaturityEvidence(evidence);
    return evidence;
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

let defaultReasoner: SemanticReasoner | null = null;

export function getSemanticReasoner(ctx: ReasonerContext): SemanticReasoner {
  if (!defaultReasoner) {
    defaultReasoner = new SemanticReasoner(ctx);
  }
  return defaultReasoner;
}

export function resetSemanticReasoner(): void {
  defaultReasoner = null;
}

/** Convenience: generate insights from patterns and journal. */
export function generateInsights(
  shitennoDir: string,
  projectRoot: string,
  patterns: DetectedPattern[],
  journal: ChangeJournal
): SemanticInsight[] {
  return getSemanticReasoner({ shitennoDir, projectRoot, patterns, journal }).reason();
}
