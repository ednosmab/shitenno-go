/**
 * backlog-parser.ts — Parser for BACKLOG.md
 *
 * Reads BACKLOG.md and extracts backlog items defined with the format:
 * ### ID Title
 * | **Campo** | Valor |
 * ...
 */

import { existsSync, readFileSync } from "node:fs";

export interface BacklogItem {
  id: string;
  title: string;
  state: string; // The raw status field, corresponding to BacklogState
  severity: string;
  priority: string;
  owner: string;
  description: string;
}

/**
 * Parse BACKLOG.md and extract items with their states and properties.
 */
export function parseBacklog(backlogPath: string): BacklogItem[] {
  if (!existsSync(backlogPath)) return [];

  const items: BacklogItem[] = [];
  const content = readFileSync(backlogPath, "utf-8");
  const lines = content.split("\n");

  let currentSection = "";
  let currentItem: Partial<BacklogItem> | null = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^## (P[0-9]+)\s/);
    if (sectionMatch) {
      currentSection = sectionMatch[1]!;
      continue;
    }

    const itemMatch = line.match(/^### (.+)/);
    if (itemMatch) {
      if (currentItem?.id) {
        items.push(currentItem as BacklogItem);
      }

      const titleRaw = itemMatch[1]!;
      const id = titleRaw.split(" ")[0]!;
      currentItem = {
        id,
        title: titleRaw,
        state: "",
        severity: "",
        priority: currentSection,
        owner: "",
        description: "",
      };
      continue;
    }

    if (currentItem && line.startsWith("| **")) {
      const match = line.match(/\*\*(\w+)\*\*\s*\|\s*(.+?)\s*\|?\s*$/);
      if (match) {
        const [, key, value] = match;
        const val = value!.trim().replace(/\|$/, "").trim();

        switch (key) {
          case "Status":
            currentItem.state = val;
            break;
          case "Severity":
            currentItem.severity = val;
            break;
          case "Priority":
            currentItem.priority = val;
            break;
          case "Owner":
            currentItem.owner = val;
            break;
          case "Descricao":
            currentItem.description = val;
            break;
        }
      }
    }
  }

  if (currentItem?.id) {
    items.push(currentItem as BacklogItem);
  }

  return items;
}
