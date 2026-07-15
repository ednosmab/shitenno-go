/**
 * content.tsx — Markdown content renderer for handbook topics
 *
 * Displays the content of a selected handbook topic.
 * Supports scrolling within its own viewport (isolated from sidebar scroll).
 */

import { Box, Text } from "ink";
import type { HandbookTopic } from "../types.js";

interface ContentProps {
  topic: HandbookTopic | null;
  content: string | null;
  scrollOffset: number;
  maxVisibleLines: number;
}

export function Content({ topic, content, scrollOffset, maxVisibleLines }: ContentProps) {
  if (!topic || !content) {
    return (
      <Box flexDirection="column" width="60%" height="100%" overflow="hidden" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Handbook
          </Text>
        </Box>
        <Text dimColor>
          Selecione um topico na barra lateral para ver o conteudo.
        </Text>
        <Box marginTop={1}>
          <Text dimColor>
            Use ↑↓ para navegar, Enter para selecionar.
          </Text>
        </Box>
      </Box>
    );
  }

  const lines = content.split("\n");
  const visibleLines = lines.slice(scrollOffset, scrollOffset + maxVisibleLines);

  return (
    <Box flexDirection="column" width="60%" height="100%" overflow="hidden" padding={1} flexGrow={1}>
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="cyan">
          {topic.title}
        </Text>
        <Text dimColor>
          Nivel {topic.level} — {topic.levelName}
        </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} height={maxVisibleLines} overflow="hidden">
        {visibleLines.map((line, index) => (
          <ContentLine key={`${scrollOffset}-${index}`} line={line} />
        ))}
      </Box>

      {lines.length > maxVisibleLines && (
        <Box marginTop={1}>
          <Text dimColor>
            Linhas {scrollOffset + 1}-{Math.min(scrollOffset + maxVisibleLines, lines.length)} de {lines.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Every branch below renders exactly one terminal row per markdown line.
 * `wrap="wrap"` is applied on every top-level <Text> so a long
 * line (table, code, long sentence) is cut with an ellipsis instead of
 * wrapping onto a second row. Without this, a single long line can push
 * the total rendered height past the terminal's row count, and it's the
 * terminal itself — not Ink — that scrolls to compensate. That native
 * scroll drags the sidebar along with it, which looks like "the sidebar
 * scroll is influenced by the content scroll" even though the two panels
 * have fully independent scroll state.
 */
function ContentLine({ line }: { line: string }) {
  // Headers
  if (line.startsWith("# ")) {
    return <Text bold color="cyan" wrap="wrap">{line.slice(2)}</Text>;
  }
  if (line.startsWith("## ")) {
    return <Text bold color="blue" wrap="wrap">{line.slice(3)}</Text>;
  }
  if (line.startsWith("### ")) {
    return <Text bold color="green" wrap="wrap">{line.slice(4)}</Text>;
  }

  // Empty lines
  if (line.trim() === "") {
    return <Text>{" "}</Text>;
  }

  // Bold text (simple markdown)
  const boldRegex = /\*\*(.*?)\*\*/g;
  if (boldRegex.test(line)) {
    const parts = line.split(boldRegex);
    return (
      <Text wrap="wrap">
        {parts.map((part, i) => {
          // Odd indices are the captured groups (bold text)
          if (i % 2 === 1) {
            return <Text key={i} bold>{part}</Text>;
          }
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  }

  // Code blocks
  if (line.startsWith("```")) {
    return <Text dimColor wrap="wrap">{line}</Text>;
  }

  // Code inline
  if (line.includes("`")) {
    const parts = line.split(/`/);
    return (
      <Text wrap="wrap">
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            return <Text key={i} color="yellow">{part}</Text>;
          }
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  }

  // Tables
  if (line.includes("|")) {
    return <Text color="gray" wrap="wrap">{line}</Text>;
  }

  // Default
  return <Text wrap="wrap">{line}</Text>;
}
