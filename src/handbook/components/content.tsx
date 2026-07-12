/**
 * content.tsx — Markdown content renderer for handbook topics
 *
 * Displays the content of a selected handbook topic.
 * Supports scrolling and keyboard navigation.
 */

import { Box, Text } from "ink";
import type { HandbookTopic } from "../types.js";

interface ContentProps {
  topic: HandbookTopic | null;
  content: string | null;
  scrollOffset: number;
}

export function Content({ topic, content, scrollOffset }: ContentProps) {
  if (!topic || !content) {
    return (
      <Box flexDirection="column" width="60%" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            Handbook
          </Text>
        </Box>
        <Text dimColor>
          Selecione um tópico na barra lateral para ver o conteúdo.
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
  const visibleLines = lines.slice(scrollOffset, scrollOffset + 30);

  return (
    <Box flexDirection="column" width="60%" padding={1}>
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="cyan">
          {topic.title}
        </Text>
        <Text dimColor>
          Nível {topic.level} — {topic.levelName}
        </Text>
      </Box>

      <Box flexDirection="column">
        {visibleLines.map((line, index) => (
          <ContentLine key={`${scrollOffset}-${index}`} line={line} />
        ))}
      </Box>

      {lines.length > 30 && (
        <Box marginTop={1}>
          <Text dimColor>
            Linhas {scrollOffset + 1}-{Math.min(scrollOffset + 30, lines.length)} de {lines.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function ContentLine({ line }: { line: string }) {
  // Headers
  if (line.startsWith("# ")) {
    return <Text bold color="cyan">{line.slice(2)}</Text>;
  }
  if (line.startsWith("## ")) {
    return <Text bold color="blue">{line.slice(3)}</Text>;
  }
  if (line.startsWith("### ")) {
    return <Text bold color="green">{line.slice(4)}</Text>;
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
      <Text>
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
    return <Text dimColor>{line}</Text>;
  }

  // Code inline
  if (line.includes("`")) {
    const parts = line.split(/`/);
    return (
      <Text>
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
    return <Text color="gray">{line}</Text>;
  }

  // Default
  return <Text>{line}</Text>;
}
