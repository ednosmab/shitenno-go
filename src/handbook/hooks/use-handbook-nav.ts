/**
 * use-handbook-nav.ts — Navigation hook for the interactive handbook
 *
 * Manages tree navigation, topic selection, scroll position,
 * and content display with history stack for back navigation.
 */

import { useState, useCallback, useMemo } from "react";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { HandbookLevel, HandbookTopic, ViewMode } from "../types.js";

function findHandbookRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, "docs", "handbook"))) return join(dir, "docs", "handbook");
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume running from project root
  return join(process.cwd(), "docs", "handbook");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const HANDBOOK_ROOT = findHandbookRoot(__dirname);

// ── Topic Registry ─────────────────────────────────────────────────────────

const TOPIC_REGISTRY: HandbookTopic[] = [
  // Level 1 — Fundamentals
  { id: "what-is-shitenno", level: 1, levelName: "Fundamentos", title: "O que é Shugo", description: "Definição, problema que resolve, para quem serve", file: "01-fundamentals/what-is-shitenno.md" },
  { id: "installation", level: 1, levelName: "Fundamentos", title: "Instalação", description: "Pré-requisitos, métodos de instalação, verificação", file: "01-fundamentals/installation.md" },
  { id: "quick-start", level: 1, levelName: "Fundamentos", title: "Primeiros Passos", description: "Init, status, detect, briefing, feedback", file: "01-fundamentals/quick-start.md" },
  { id: "concepts", level: 1, levelName: "Fundamentos", title: "Conceitos", description: "Maturity, capabilities, governance, knowledge debt", file: "01-fundamentals/concepts.md" },

  // Level 2 — Commands
  { id: "setup", level: 2, levelName: "Comandos", title: "Setup & Config", description: "init, mcp, upgrade, clean", file: "02-commands/setup.md" },
  { id: "analysis", level: 2, levelName: "Comandos", title: "Status & Análise", description: "status, audit, doctor, assess, detect", file: "02-commands/analysis.md" },
  { id: "pipeline", level: 2, levelName: "Comandos", title: "Pipeline & Execução", description: "run, evolve, act, plan", file: "02-commands/pipeline.md" },
  { id: "governance", level: 2, levelName: "Comandos", title: "Governança", description: "goal, decide, policy", file: "02-commands/governance.md" },
  { id: "reports", level: 2, levelName: "Comandos", title: "Relatórios", description: "console, report, digest, bench", file: "02-commands/reports.md" },
  { id: "ai-integration", level: 2, levelName: "Comandos", title: "Integração AI", description: "briefing, feedback, profile, dashboard, reminders", file: "02-commands/ai-integration.md" },
  { id: "system", level: 2, levelName: "Comandos", title: "Sistema", description: "validate, shell-init", file: "02-commands/system.md" },
  { id: "documentation", level: 2, levelName: "Comandos", title: "Documentação", description: "docs-audit", file: "02-commands/documentation.md" },

  // Level 3 — Architecture
  { id: "event-system", level: 3, levelName: "Arquitetura", title: "Sistema de Eventos", description: "Event bus, tipos de eventos, subscribe/publish", file: "03-architecture/event-system.md" },
  { id: "rule-engine", level: 3, levelName: "Arquitetura", title: "Rule Engine", description: "Regras reativas, triggers, como criar regras", file: "03-architecture/rule-engine.md" },
  { id: "mcp-server", level: 3, levelName: "Arquitetura", title: "MCP Server", description: "Protocolo MCP, configuração, uso com AI agents", file: "03-architecture/mcp-server.md" },
  { id: "custom-rules", level: 3, levelName: "Arquitetura", title: "Regras Customizadas", description: "Como criar regras próprias", file: "03-architecture/custom-rules.md" },
  { id: "contributing", level: 3, levelName: "Arquitetura", title: "Contribuindo", description: "Guia para contribuidores", file: "03-architecture/contributing.md" },
];

// ── Build Levels ───────────────────────────────────────────────────────────

function buildLevels(): HandbookLevel[] {
  const levelMap = new Map<number, HandbookTopic[]>();

  for (const topic of TOPIC_REGISTRY) {
    const existing = levelMap.get(topic.level) || [];
    existing.push(topic);
    levelMap.set(topic.level, existing);
  }

  const levelNames: Record<number, { name: string; description: string }> = {
    1: { name: "Fundamentos", description: "Para qualquer pessoa" },
    2: { name: "Comandos", description: "Para developers" },
    3: { name: "Arquitetura", description: "Para architects" },
  };

  return Array.from(levelMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([number, topics]) => ({
      number,
      name: levelNames[number]?.name || `Nível ${number}`,
      description: levelNames[number]?.description || "",
      topics,
    }));
}

// ── Read Topic Content ─────────────────────────────────────────────────────

function readTopicContent(topic: HandbookTopic): string | null {
  const filePath = join(HANDBOOK_ROOT, topic.file);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

// ── Navigation Items ───────────────────────────────────────────────────────

export interface NavItem {
  type: "level" | "topic";
  levelNumber: number;
  levelName: string;
  topic?: HandbookTopic;
  isSelected: boolean;
  isExpanded: boolean;
}

function buildNavItems(
  levels: HandbookLevel[],
  expandedLevel: number | null,
  selectedIndex: number
): NavItem[] {
  const items: NavItem[] = [];
  let currentIndex = 0;

  for (const level of levels) {
    const isExpanded = expandedLevel === level.number;
    items.push({
      type: "level",
      levelNumber: level.number,
      levelName: level.name,
      isSelected: currentIndex === selectedIndex,
      isExpanded,
    });
    currentIndex++;

    if (isExpanded) {
      for (const topic of level.topics) {
        items.push({
          type: "topic",
          levelNumber: level.number,
          levelName: level.name,
          topic,
          isSelected: currentIndex === selectedIndex,
          isExpanded: false,
        });
        currentIndex++;
      }
    }
  }

  return items;
}

export interface HandbookNavState {
  viewMode: ViewMode;
  levels: HandbookLevel[];
  expandedLevel: number | null;
  selectedIndex: number;
  sidebarScrollOffset: number;
  selectedTopic: HandbookTopic | null;
  content: string | null;
  navItems: NavItem[];
  totalItems: number;
}

function adjustScroll(selected: number, scroll: number, viewport: number): number {
  if (selected < scroll) return selected;
  if (selected >= scroll + viewport) return selected - viewport + 1;
  return scroll;
}

function expandLevelUpdate(prev: HandbookNavState, levelNumber: number): HandbookNavState {
  const newExpanded = prev.expandedLevel === levelNumber ? null : levelNumber;
  const newNavItems = buildNavItems(prev.levels, newExpanded, 0);
  return {
    ...prev,
    expandedLevel: newExpanded,
    selectedIndex: 0,
    sidebarScrollOffset: 0,
    navItems: newNavItems,
    totalItems: newNavItems.length,
    viewMode: "tree",
    selectedTopic: null,
    content: null,
  };
}

function moveUpdate(prev: HandbookNavState, delta: number, maxVisible: number | undefined): HandbookNavState {
  const newSelected = delta < 0
    ? Math.max(0, prev.selectedIndex + delta)
    : Math.min(prev.totalItems - 1, prev.selectedIndex + delta);
  const viewport = maxVisible ?? Infinity;
  return {
    ...prev,
    selectedIndex: newSelected,
    sidebarScrollOffset: adjustScroll(newSelected, prev.sidebarScrollOffset, viewport),
  };
}

function toggleLevelAt(prev: HandbookNavState, index: number, maxVisible?: number): HandbookNavState {
  const currentItem = prev.navItems[index];
  if (!currentItem || currentItem.type !== "level") return prev;
  const newExpanded = prev.expandedLevel === currentItem.levelNumber ? null : currentItem.levelNumber;
  const newNavItems = buildNavItems(prev.levels, newExpanded, index);
  const viewport = maxVisible ?? Infinity;
  return {
    ...prev,
    selectedIndex: index,
    sidebarScrollOffset: adjustScroll(index, prev.sidebarScrollOffset, viewport),
    expandedLevel: newExpanded,
    navItems: newNavItems,
    totalItems: newNavItems.length,
    viewMode: "tree",
    selectedTopic: null,
    content: null,
  };
}

function openTopicAt(prev: HandbookNavState, index: number): HandbookNavState {
  const currentItem = prev.navItems[index];
  if (!currentItem || currentItem.type !== "topic" || !currentItem.topic) return prev;
  return {
    ...prev,
    selectedIndex: index,
    viewMode: "content",
    selectedTopic: currentItem.topic,
    content: readTopicContent(currentItem.topic),
  };
}

function selectCurrentUpdate(prev: HandbookNavState): HandbookNavState {
  const currentItem = prev.navItems[prev.selectedIndex];
  if (!currentItem) return prev;
  if (currentItem.type === "level") {
    const newExpanded = prev.expandedLevel === currentItem.levelNumber ? null : currentItem.levelNumber;
    const newNavItems = buildNavItems(prev.levels, newExpanded, prev.selectedIndex);
    return { ...prev, expandedLevel: newExpanded, navItems: newNavItems, totalItems: newNavItems.length, sidebarScrollOffset: 0, viewMode: "tree", selectedTopic: null, content: null };
  }
  return openTopicAt(prev, prev.selectedIndex);
}

function goBackUpdate(prev: HandbookNavState): HandbookNavState {
  if (prev.viewMode !== "content") return prev;
  return { ...prev, viewMode: "tree", sidebarScrollOffset: 0, selectedTopic: null, content: null };
}

function jumpToLevelUpdate(prev: HandbookNavState, levelNumber: number): HandbookNavState {
  const level = prev.levels.find((l) => l.number === levelNumber);
  if (!level) return prev;
  const newNavItems = buildNavItems(prev.levels, levelNumber, 0);
  const firstTopicIndex = newNavItems.findIndex((item) => item.type === "level" && item.levelNumber === levelNumber);
  return {
    ...prev,
    expandedLevel: levelNumber,
    selectedIndex: firstTopicIndex >= 0 ? firstTopicIndex : 0,
    sidebarScrollOffset: 0,
    navItems: newNavItems,
    totalItems: newNavItems.length,
    viewMode: "tree",
    selectedTopic: null,
    content: null,
  };
}

function selectTopicByIdUpdate(prev: HandbookNavState, topicId: string): HandbookNavState {
  const topic = TOPIC_REGISTRY.find((t) => t.id === topicId);
  if (!topic) return prev;
  return { ...prev, viewMode: "content", selectedTopic: topic, content: readTopicContent(topic) };
}

function selectAtUpdate(prev: HandbookNavState, index: number, maxVisible?: number): HandbookNavState {
  const currentItem = prev.navItems[index];
  if (!currentItem) return prev;
  if (currentItem.type === "level") return toggleLevelAt(prev, index, maxVisible);
  return openTopicAt(prev, index);
}

export function useHandbookNav() {
  const levels = useMemo(() => buildLevels(), []);

  const [state, setState] = useState<HandbookNavState>(() => ({
    viewMode: "tree", levels, expandedLevel: null, selectedIndex: 0,
    sidebarScrollOffset: 0, selectedTopic: null, content: null,
    navItems: buildNavItems(levels, null, 0), totalItems: levels.length,
  }));

  const expandLevel = useCallback((levelNumber: number) => {
    setState((prev) => expandLevelUpdate(prev, levelNumber));
  }, []);

  const moveUp = useCallback((maxVisible?: number) => {
    setState((prev) => moveUpdate(prev, -1, maxVisible));
  }, []);

  const moveDown = useCallback((maxVisible?: number) => {
    setState((prev) => moveUpdate(prev, 1, maxVisible));
  }, []);

  const selectCurrent = useCallback(() => {
    setState(selectCurrentUpdate);
  }, []);

  const selectAt = useCallback((index: number, maxVisible?: number) => {
    setState((prev) => selectAtUpdate(prev, index, maxVisible));
  }, []);

  const goBack = useCallback(() => {
    setState(goBackUpdate);
  }, []);

  const jumpToLevel = useCallback((levelNumber: number) => {
    setState((prev) => jumpToLevelUpdate(prev, levelNumber));
  }, []);

  const selectTopicById = useCallback((topicId: string) => {
    setState((prev) => selectTopicByIdUpdate(prev, topicId));
  }, []);

  const setSidebarScroll = useCallback((offset: number) => {
    setState((prev) => ({ ...prev, sidebarScrollOffset: Math.max(0, offset) }));
  }, []);

  return {
    ...state,
    expandLevel,
    moveUp,
    moveDown,
    selectCurrent,
    selectAt,
    goBack,
    jumpToLevel,
    selectTopicById,
    setSidebarScroll,
  };
}
