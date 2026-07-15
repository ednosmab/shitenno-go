import type { PersonalizedFeedback } from "./profile.js";

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

  lines.push("### O que fizeste bem");
  lines.push("");
  for (let i = 0; i < feedback.strengths.length; i++) {
    const item = feedback.strengths[i];
    if (item) {
      lines.push(`${i + 1}. **${item.title}** — ${item.description}`);
      lines.push("");
    }
  }

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

  lines.push("### Próximo nível");
  lines.push("");
  lines.push(feedback.nextLevel);
  lines.push("");

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
