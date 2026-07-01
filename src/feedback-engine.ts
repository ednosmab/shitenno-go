/**
 * feedback-engine.ts — Context Pipeline: Personalized Feedback Engine
 *
 * Generates personalized feedback for both the AI agent and the user,
 * calibrated to the user's profile (Tech Lead em Formação, T-shaped, etc.).
 *
 * PRINCIPLE: Feedback adapts to the person, not the other way around.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SessionFeedbackRecord, SessionOutcome } from "./session-feedback.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type SkillLevel = "junior" | "pleno" | "senior";

export type FeedbackTone = "mentor" | "peer" | "relatorio";

export interface UserProfile {
  /** User name. */
  name: string;
  /** Role description (e.g., "Tech Lead em Formação"). */
  role: string;
  /** Architecture skill level. */
  architecture: SkillLevel;
  /** Coding skill level. */
  coding: SkillLevel;
  /** Leadership/soft skills level. */
  leadership: SkillLevel;
  /** Preferred feedback tone. */
  tone: FeedbackTone;
  /** Language preference (pt, en). */
  language: "pt" | "en";
  /** What percentage of feedback should be code-free (0-100). */
  codeFreePercent: number;
  /** Focus areas (e.g., ["visão", "leadership"]). */
  focusAreas: string[];
}

export interface FeedbackItem {
  /** Category of the feedback item. */
  category: "strength" | "improvement";
  /** Title of the item. */
  title: string;
  /** Detailed description (calibrated to tone). */
  description: string;
  /** What happened (only for improvements). */
  whatHappened?: string;
  /** Tech lead perspective (only for improvements). */
  techLeadPerspective?: string;
  /** Practical rule (only for improvements). */
  practicalRule?: string;
}

// Re-export SessionFeedbackRecord for convenience
export type { SessionFeedbackRecord } from "./session-feedback.js";

export interface LeadershipMetrics {
  /** Metric name. */
  name: string;
  /** Rating: forte (strong), a melhorar (needs improvement), neutro (neutral). */
  rating: "forte" | "a melhorar" | "neutro";
  /** Optional note. */
  note?: string;
}

export interface PersonalizedFeedback {
  /** ISO date. */
  date: string;
  /** User profile used for calibration. */
  profile: UserProfile;
  /** Session number (within the day). */
  sessionNumber: number;
  /** Session timestamp. */
  sessionTimestamp: string;
  /** What went well. */
  strengths: FeedbackItem[];
  /** What can improve (with tech lead reasoning). */
  improvements: FeedbackItem[];
  /** Next level guidance. */
  nextLevel: string;
  /** Leadership metrics. */
  metrics: LeadershipMetrics[];
  /** Agent performance summary (what the AI did well/poorly). */
  agentPerformance: {
    strengths: string[];
    improvements: string[];
  };
}

// ── Profile Loading ────────────────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  name: "Developer",
  role: "Developer",
  architecture: "pleno",
  coding: "pleno",
  leadership: "pleno",
  tone: "peer",
  language: "pt",
  codeFreePercent: 50,
  focusAreas: [],
};

/**
 * Load user profile from nexus-system/user-profile.json.
 */
export function loadUserProfile(nexusDir: string): UserProfile {
  const profilePath = join(nexusDir, "user-profile.json");
  if (!existsSync(profilePath)) {
    return DEFAULT_PROFILE;
  }
  try {
    const content = readFileSync(profilePath, "utf-8");
    const data = JSON.parse(content);
    return { ...DEFAULT_PROFILE, ...data };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/**
 * Save user profile to nexus-system/user-profile.json.
 */
export function saveUserProfile(nexusDir: string, profile: UserProfile): void {
  const profilePath = join(nexusDir, "user-profile.json");
  const dir = join(nexusDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(profilePath, JSON.stringify(profile, null, 2), "utf-8");
}

// ── Profile Inference ──────────────────────────────────────────────────────

export interface SessionBehaviorData {
  /** Total sessions recorded. */
  totalSessions: number;
  /** Success rate (0-1). */
  successRate: number;
  /** Average duration in minutes. */
  avgDuration: number | null;
  /** Number of times user rejected recommendations. */
  rejectedRecommendations: number;
  /** Number of times user accepted recommendations. */
  acceptedRecommendations: number;
  /** Commands used frequently. */
  frequentCommands: string[];
  /** Areas with most failures. */
  failureAreas: string[];
  /** Whether user asks for explanations (inferred from notes). */
  asksForExplanations: boolean;
}

/**
 * Infer user profile from behavioral data.
 * Uses session history to estimate skill levels and preferences.
 */
export function inferProfile(
  nexusDir: string,
  behaviorData: SessionBehaviorData
): UserProfile {
  const currentProfile = loadUserProfile(nexusDir);

  // Estimate architecture level based on success rate and command usage
  let architecture: SkillLevel = currentProfile.architecture;
  if (behaviorData.totalSessions >= 10) {
    if (behaviorData.successRate >= 0.8 && behaviorData.frequentCommands.includes("audit")) {
      architecture = "senior";
    } else if (behaviorData.successRate >= 0.5) {
      architecture = "pleno";
    } else {
      architecture = "junior";
    }
  }

  // Estimate coding level based on success rate and failure areas
  let coding: SkillLevel = currentProfile.coding;
  if (behaviorData.totalSessions >= 10) {
    if (behaviorData.successRate >= 0.8 && behaviorData.failureAreas.length <= 2) {
      coding = "senior";
    } else if (behaviorData.successRate >= 0.5) {
      coding = "pleno";
    } else {
      coding = "junior";
    }
  }

  // Estimate leadership level based on recommendation acceptance
  let leadership: SkillLevel = currentProfile.leadership;
  if (behaviorData.totalSessions >= 10) {
    const acceptanceRate = behaviorData.acceptedRecommendations /
      (behaviorData.acceptedRecommendations + behaviorData.rejectedRecommendations || 1);
    if (acceptanceRate >= 0.8 && behaviorData.frequentCommands.includes("status")) {
      leadership = "senior";
    } else if (acceptanceRate >= 0.5) {
      leadership = "pleno";
    } else {
      leadership = "junior";
    }
  }

  // Estimate tone preference based on behavior
  let tone: FeedbackTone = currentProfile.tone;
  if (behaviorData.asksForExplanations && behaviorData.successRate < 0.5) {
    tone = "mentor"; // User needs more guidance
  } else if (behaviorData.successRate >= 0.8 && leadership === "senior") {
    tone = "peer"; // Senior user prefers peer feedback
  }

  // Estimate code-free percentage based on role and focus
  let codeFreePercent = currentProfile.codeFreePercent;
  if (architecture === "senior" || leadership === "senior") {
    codeFreePercent = Math.max(codeFreePercent, 70);
  }

  return {
    ...currentProfile,
    architecture,
    coding,
    leadership,
    tone,
    codeFreePercent,
  };
}

/**
 * Update profile based on a single session outcome.
 * Incremental update after each session.
 */
export function updateProfileFromSession(
  nexusDir: string,
  outcome: SessionOutcome,
  followedRecommendations: boolean,
  durationMinutes: number | undefined
): UserProfile {
  const profile = loadUserProfile(nexusDir);
  const behaviorData: SessionBehaviorData = {
    totalSessions: 1,
    successRate: outcome === "success" ? 1 : outcome === "partial" ? 0.5 : 0,
    avgDuration: durationMinutes ?? null,
    rejectedRecommendations: followedRecommendations ? 0 : 1,
    acceptedRecommendations: followedRecommendations ? 1 : 0,
    frequentCommands: [],
    failureAreas: [],
    asksForExplanations: false,
  };

  return inferProfile(nexusDir, behaviorData);
}

// ── Tone Calibration ──────────────────────────────────────────────────────

/**
 * Determine the appropriate tone based on profile and outcome.
 */
export function calibrateTone(
  profile: UserProfile,
  outcome: SessionOutcome,
  skillLevel: SkillLevel
): FeedbackTone {
  // If profile specifies a tone, use it
  if (profile.tone === "mentor") return "mentor";
  if (profile.tone === "relatorio") return "relatorio";

  // Auto-calibrate based on outcome and skill level
  if (outcome === "failure" && skillLevel === "junior") {
    return "mentor"; // Be supportive with junior on failure
  }
  if (outcome === "success" && skillLevel === "senior") {
    return "peer"; // Peer-to-peer for senior on success
  }
  if (outcome === "failure" && skillLevel === "senior") {
    return "peer"; // Don't patronize senior
  }

  // Default
  return profile.tone;
}

/**
 * Generate a greeting/calibration message based on tone and language.
 */
export function getToneGreeting(tone: FeedbackTone, language: "pt" | "en"): string {
  if (language === "en") {
    switch (tone) {
      case "mentor": return "Let's reflect on this session together.";
      case "peer": return "Here's my take on what happened.";
      case "relatorio": return "Session analysis report.";
    }
  }
  switch (tone) {
    case "mentor": return "Vamos reflectir juntos sobre esta sessão.";
    case "peer": return "Aqui está a minha leitura do que aconteceu.";
    case "relatorio": return "Relatório de análise da sessão.";
  }
}

// ── Feedback Generation ───────────────────────────────────────────────────

/**
 * Generate personalized feedback based on session data and user profile.
 */
export function generatePersonalizedFeedback(
  record: SessionFeedbackRecord,
  profile: UserProfile,
  agentActions: { whatAgentDid: string[]; whatAgentMissed: string[] } = {
    whatAgentDid: [],
    whatAgentMissed: [],
  }
): PersonalizedFeedback {
  const tone = calibrateTone(profile, record.outcome, profile.architecture);
  const dateParts = new Date(record.timestamp).toISOString().split("T");
  const date = dateParts[0] || new Date().toISOString().split("T")[0] || "2026-07-01";
  const sessionTime = new Date(record.timestamp).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const strengths: FeedbackItem[] = [];
  const improvements: FeedbackItem[] = [];

  // Generate strengths based on outcome
  if (record.outcome === "success") {
    strengths.push(...generateSuccessStrengths(record, profile, tone));
  } else if (record.outcome === "failure") {
    strengths.push(...generateFailureStrengths(record, profile, tone));
    improvements.push(...generateFailureImprovements(record, profile, tone));
  } else {
    strengths.push(...generatePartialStrengths(record, profile, tone));
    improvements.push(...generatePartialImprovements(record, profile, tone));
  }

  // Add agent-specific feedback
  if (agentActions.whatAgentDid.length > 0) {
    strengths.push({
      category: "strength",
      title: "Agent collaboration",
      description: formatAgentStrengths(agentActions.whatAgentDid, tone, profile.language),
    });
  }

  if (agentActions.whatAgentMissed.length > 0) {
    improvements.push({
      category: "improvement",
      title: "Agent communication",
      description: formatAgentImprovements(agentActions.whatAgentMissed, tone, profile.language),
    });
  }

  // Generate next level guidance
  const nextLevel = generateNextLevelGuidance(record.outcome, profile, tone);

  // Generate leadership metrics
  const metrics = generateLeadershipMetrics(record, profile, tone);

  return {
    date,
    profile,
    sessionNumber: 1,
    sessionTimestamp: sessionTime,
    strengths,
    improvements,
    nextLevel,
    metrics,
    agentPerformance: {
      strengths: agentActions.whatAgentDid,
      improvements: agentActions.whatAgentMissed,
    },
  };
}

// ── Strength Generation ──────────────────────────────────────────────────

function generateSuccessStrengths(
  record: SessionFeedbackRecord,
  profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "strength",
      title: "Correct outcome achieved",
      description: `Excelente! Completaste a sessão com sucesso. ${profile.architecture === "senior" ? "A tua capacidade de orientar o time é evidente." : "Estás no caminho certo."}`,
    });
  } else if (tone === "peer") {
    items.push({
      category: "strength",
      title: "Session successful",
      description: `Boa sessão. ${record.modifiedAreas && record.modifiedAreas.length > 0 ? `Áreas trabalhadas: ${record.modifiedAreas.join(", ")}.` : ""}`,
    });
  } else {
    items.push({
      category: "strength",
      title: "Outcome: success",
      description: `Sessão concluída com sucesso. ${record.durationMinutes ? `Duração: ${record.durationMinutes}min.` : ""}`,
    });
  }

  if (record.followedRecommendations) {
    items.push({
      category: "strength",
      title: "Followed recommendations",
      description: tone === "mentor"
        ? "Seguiste as recomendações do briefing — isso demonstra disciplina técnica."
        : "Briefing recommendations followed.",
    });
  }

  return items;
}

function generateFailureStrengths(
  record: SessionFeedbackRecord,
  profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "strength",
      title: "Identified the problem",
      description: "O facto de identificares que algo correu mal já é um passo importante. Muitos desenvolvedores ignoram os sinais.",
    });
  } else if (tone === "peer") {
    items.push({
      category: "strength",
      title: "Problem identification",
      description: "Good catch on identifying the failure point.",
    });
  } else {
    items.push({
      category: "strength",
      title: "Failure acknowledged",
      description: "Session outcome: failure. Problem identified.",
    });
  }

  return items;
}

function generatePartialStrengths(
  record: SessionFeedbackRecord,
  profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "strength",
      title: "Partial progress made",
      description: "Mesmo com dificuldades, avançaste. Isso mostra resiliência.",
    });
  } else {
    items.push({
      category: "strength",
      title: "Partial progress",
      description: "Session completed with partial success.",
    });
  }

  return items;
}

// ── Improvement Generation ────────────────────────────────────────────────

function generateFailureImprovements(
  record: SessionFeedbackRecord,
  profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "improvement",
      title: "Verify before diagnosing",
      description: "Às vezes diagnosticamos sem verificar o estado actual.",
      whatHappened: `Sessão com outcome failure. ${record.modifiedAreas ? `Áreas afectadas: ${record.modifiedAreas.join(", ")}.` : ""}`,
      techLeadPerspective: "Antes de investigar o código, verifica: Este run está a correr o commit mais recente?",
      practicalRule: "`git log --oneline -1` + comparar com o estado actual.",
    });
  } else if (tone === "peer") {
    items.push({
      category: "improvement",
      title: "Root cause analysis",
      description: "Consider checking the current state before deep-diving into code.",
      whatHappened: `Session failed. ${record.modifiedAreas ? `Areas: ${record.modifiedAreas.join(", ")}.` : ""}`,
      practicalRule: "Check git log before debugging.",
    });
  } else {
    items.push({
      category: "improvement",
      title: "Failure analysis needed",
      description: "Session failed. Root cause analysis recommended.",
      whatHappened: `Areas affected: ${record.modifiedAreas?.join(", ") || "unknown"}.`,
    });
  }

  if (record.notes) {
    items.push({
      category: "improvement",
      title: "Notes recorded",
      description: `Nota: "${record.notes}".`,
    });
  }

  return items;
}

function generatePartialImprovements(
  record: SessionFeedbackRecord,
  profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "improvement",
      title: "Scope management",
      description: "O escopo pode ter crescido durante a sessão.",
      whatHappened: "Sessão parcialmente concluída.",
      techLeadPerspective: "Define limites claros antes de começar. Pergunta: 'O que é que precisa de ficar pronto hoje?'",
      practicalRule: "Timebox: define 2-3 objectivos máximos por sessão.",
    });
  } else {
    items.push({
      category: "improvement",
      title: "Scope control",
      description: "Consider setting clearer boundaries for the session.",
      practicalRule: "Set 2-3 max objectives per session.",
    });
  }

  return items;
}

// ── Agent Feedback Formatting ─────────────────────────────────────────────

function formatAgentStrengths(
  actions: string[],
  tone: FeedbackTone,
  language: "pt" | "en"
): string {
  if (language === "en") {
    return `Agent performed well: ${actions.join("; ")}.`;
  }
  if (tone === "mentor") {
    return `O agente executou bem: ${actions.join("; ")}.`;
  }
  return `Agente: ${actions.join("; ")}.`;
}

function formatAgentImprovements(
  missed: string[],
  tone: FeedbackTone,
  language: "pt" | "en"
): string {
  if (language === "en") {
    return `Agent could improve: ${missed.join("; ")}.`;
  }
  if (tone === "mentor") {
    return `O agente poderia melhorar: ${missed.join("; ")}.`;
  }
  return `Agente (a melhorar): ${missed.join("; ")}.`;
}

// ── Next Level Guidance ───────────────────────────────────────────────────

function generateNextLevelGuidance(
  outcome: SessionOutcome,
  profile: UserProfile,
  tone: FeedbackTone
): string {
  if (profile.language === "en") {
    if (outcome === "success") {
      return "Keep building on this momentum. Focus on consistency.";
    }
    if (outcome === "failure") {
      return "Every failure is a learning opportunity. Focus on the process, not the outcome.";
    }
    return "Progress is progress. Focus on completing the next step.";
  }

  // Portuguese
  if (tone === "mentor") {
    if (outcome === "success") {
      return "Continua neste ritmo. A consistência é a chave para a mastery.";
    }
    if (outcome === "failure") {
      return "Cada falha é uma oportunidade de aprendizagem. Foca no processo, não no resultado.";
    }
    return "Progresso é progresso. Foca em completar o próximo passo.";
  }

  if (outcome === "success") {
    return "Momentum is building. Focus on consistency.";
  }
  if (outcome === "failure") {
    return "Focus on the process, not the outcome.";
  }
  return "Focus on completing the next step.";
}

// ── Leadership Metrics ────────────────────────────────────────────────────

function generateLeadershipMetrics(
  record: SessionFeedbackRecord,
  _profile: UserProfile,
  _tone: FeedbackTone
): LeadershipMetrics[] {
  const metrics: LeadershipMetrics[] = [];

  // Risk management
  if (record.outcome === "success") {
    metrics.push({
      name: "Gestão de risco",
      rating: "forte",
      note: record.followedRecommendations ? "Seguiu recomendações" : undefined,
    });
  } else {
    metrics.push({
      name: "Gestão de risco",
      rating: "a melhorar",
    });
  }

  // Problem sequencing
  if (record.modifiedAreas && record.modifiedAreas.length > 1) {
    metrics.push({
      name: "Sequenciação de problemas",
      rating: "forte",
      note: `${record.modifiedAreas.length} áreas geridas`,
    });
  }

  // Communication
  if (record.notes) {
    metrics.push({
      name: "Comunicação",
      rating: "forte",
      note: "Notas registadas",
    });
  }

  // Decision making
  metrics.push({
    name: "Tomada de decisão",
    rating: record.outcome === "success" ? "forte" : "a melhorar",
  });

  return metrics;
}

// ── Output Formatting ─────────────────────────────────────────────────────

/**
 * Format personalized feedback as Markdown.
 */
export function formatFeedbackAsMarkdown(feedback: PersonalizedFeedback): string {
  const lines: string[] = [];

  lines.push(`# Feedback Personalizado — ${feedback.date}`);
  lines.push("");
  lines.push(`## Perfil: ${feedback.profile.role}`);
  lines.push(`- Arquitectura: ${feedback.profile.architecture}`);
  lines.push(`- Código: ${feedback.profile.coding}`);
  lines.push(`- Tom: ${feedback.profile.codeFreePercent}% no-code, foco em ${feedback.profile.focusAreas.join(", ") || "visão/leadership"}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`## Sessão ${feedback.sessionNumber} (${feedback.sessionTimestamp})`);
  lines.push("");

  // Strengths
  lines.push("### O que fizeste bem");
  lines.push("");
  for (let i = 0; i < feedback.strengths.length; i++) {
    const item = feedback.strengths[i];
    if (item) {
      lines.push(`${i + 1}. **${item.title}** — ${item.description}`);
      lines.push("");
    }
  }

  // Improvements
  if (feedback.improvements.length > 0) {
    lines.push("### O que podes melhorar");
    lines.push("");
    for (let i = 0; i < feedback.improvements.length; i++) {
      const item = feedback.improvements[i];
      if (item) {
        lines.push(`${i + 1}. **${item.title}**`);
        lines.push(`   - ${item.description}`);
        if (item.whatHappened) {
          lines.push(`   - **O que aconteceu:** ${item.whatHappened}`);
        }
        if (item.techLeadPerspective) {
          lines.push(`   - **Como tech lead:** ${item.techLeadPerspective}`);
        }
        if (item.practicalRule) {
          lines.push(`   - **Regra prática:** ${item.practicalRule}`);
        }
        lines.push("");
      }
    }
  }

  // Next level
  lines.push("### Próximo nível");
  lines.push("");
  lines.push(feedback.nextLevel);
  lines.push("");

  // Leadership metrics
  if (feedback.metrics.length > 0) {
    lines.push("### Métricas de leadership");
    lines.push("");
    lines.push("| Indicador | Nota |");
    lines.push("|-----------|------|");
    for (const metric of feedback.metrics) {
      lines.push(`| ${metric.name} | ${metric.rating}${metric.note ? ` (${metric.note})` : ""} |`);
    }
    lines.push("");
  }

  // Agent performance
  if (feedback.agentPerformance.strengths.length > 0 || feedback.agentPerformance.improvements.length > 0) {
    lines.push("### Performance do Agente");
    lines.push("");
    if (feedback.agentPerformance.strengths.length > 0) {
      lines.push("**O que o agente fez bem:**");
      for (const s of feedback.agentPerformance.strengths) {
        lines.push(`- ${s}`);
      }
      lines.push("");
    }
    if (feedback.agentPerformance.improvements.length > 0) {
      lines.push("**O que o agente pode melhorar:**");
      for (const m of feedback.agentPerformance.improvements) {
        lines.push(`- ${m}`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(`*Feedback gerado automaticamente por nexus-cli para o perfil: ${feedback.profile.role}*`);

  return lines.join("\n");
}
