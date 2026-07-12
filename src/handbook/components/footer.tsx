/**
 * footer.tsx — Keyboard shortcuts footer
 *
 * Displays available keyboard shortcuts at the bottom of the screen.
 */

import { Box, Text } from "ink";

interface FooterProps {
  viewMode: "tree" | "content";
}

export function Footer({ viewMode }: FooterProps) {
  return (
    <Box
      marginTop={1}
      paddingX={1}
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      {viewMode === "tree" ? (
        <TreeShortcuts />
      ) : (
        <ContentShortcuts />
      )}
    </Box>
  );
}

function TreeShortcuts() {
  return (
    <Box gap={2}>
      <Text>
        <Text bold color="cyan">↑↓</Text>
        <Text dimColor> navegar</Text>
      </Text>
      <Text>
        <Text bold color="cyan">Enter</Text>
        <Text dimColor> expandir/abrir</Text>
      </Text>
      <Text>
        <Text bold color="cyan">1-3</Text>
        <Text dimColor> nivel</Text>
      </Text>
      <Text>
        <Text bold color="cyan">q</Text>
        <Text dimColor> sair</Text>
      </Text>
    </Box>
  );
}

function ContentShortcuts() {
  return (
    <Box gap={2}>
      <Text>
        <Text bold color="cyan">↑↓</Text>
        <Text dimColor> sidebar</Text>
      </Text>
      <Text>
        <Text bold color="cyan">Enter</Text>
        <Text dimColor> abrir</Text>
      </Text>
      <Text>
        <Text bold color="cyan">j/k</Text>
        <Text dimColor> rolar</Text>
      </Text>
      <Text>
        <Text bold color="cyan">Esc</Text>
        <Text dimColor> voltar</Text>
      </Text>
    </Box>
  );
}
