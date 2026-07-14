import type { SessionFeedbackRecord, SessionOutcome } from "../../session-feedback.js";
import type { UserProfile, FeedbackTone, FeedbackItem, LeadershipMetrics, PersonalizedFeedback } from "./profile.js";
import { calibrateTone } from "./profile.js";

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

  if (record.outcome === "success") {
    strengths.push(...generateSuccessStrengths(record, profile, tone));
  } else if (record.outcome === "failure") {
    strengths.push(...generateFailureStrengths(record, profile, tone));
    improvements.push(...generateFailureImprovements(record, profile, tone));
  } else {
    strengths.push(...generatePartialStrengths(record, profile, tone));
    improvements.push(...generatePartialImprovements(record, profile, tone));
  }

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

  const nextLevel = generateNextLevelGuidance(record.outcome, profile, tone);
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
  _record: SessionFeedbackRecord,
  _profile: UserProfile,
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
  _record: SessionFeedbackRecord,
  _profile: UserProfile,
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

function generateFailureImprovements(
  record: SessionFeedbackRecord,
  _profile: UserProfile,
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
  _record: SessionFeedbackRecord,
  _profile: UserProfile,
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

function generateLeadershipMetrics(
  record: SessionFeedbackRecord,
  _profile: UserProfile,
  _tone: FeedbackTone
): LeadershipMetrics[] {
  const metrics: LeadershipMetrics[] = [];

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

  if (record.modifiedAreas && record.modifiedAreas.length > 1) {
    metrics.push({
      name: "Sequenciação de problemas",
      rating: "forte",
      note: `${record.modifiedAreas.length} áreas geridas`,
    });
  }

  if (record.notes) {
    metrics.push({
      name: "Comunicação",
      rating: "forte",
      note: "Notas registadas",
    });
  }

  metrics.push({
    name: "Tomada de decisão",
    rating: record.outcome === "success" ? "forte" : "a melhorar",
  });

  return metrics;
}
