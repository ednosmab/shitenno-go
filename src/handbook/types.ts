/**
 * types.ts — Shared types for the interactive handbook
 */

export interface HandbookTopic {
  id: string;
  level: number;
  levelName: string;
  title: string;
  description: string;
  file: string;
}

export interface HandbookLevel {
  number: number;
  name: string;
  description: string;
  topics: HandbookTopic[];
}

export type ViewMode = "tree" | "content";

export interface HandbookState {
  viewMode: ViewMode;
  levels: HandbookLevel[];
  expandedLevel: number | null;
  selectedIndex: number;
  scrollOffset: number;
  contentScrollOffset: number;
  selectedTopic: HandbookTopic | null;
}

export interface HandbookNavItem {
  type: "level" | "topic";
  level: number;
  topicId?: string;
  label: string;
  description?: string;
}
