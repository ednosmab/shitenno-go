import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { SessionOutcome } from "../../session-feedback.js";

export type SkillLevel = "junior" | "pleno" | "senior";

export type FeedbackTone = "mentor" | "peer" | "relatorio";

export interface UserProfile {
  name: string;
  role: string;
  architecture: SkillLevel;
  coding: SkillLevel;
  leadership: SkillLevel;
  tone: FeedbackTone;
  language: "pt" | "en";
  codeFreePercent: number;
  focusAreas: string[];
}

export interface FeedbackItem {
  category: "strength" | "improvement";
  title: string;
  description: string;
  whatHappened?: string;
  techLeadPerspective?: string;
  practicalRule?: string;
}

export type { SessionFeedbackRecord } from "../../session-feedback.js";

export interface LeadershipMetrics {
  name: string;
  rating: "forte" | "a melhorar" | "neutro";
  note?: string;
}

export interface PersonalizedFeedback {
  date: string;
  profile: UserProfile;
  sessionNumber: number;
  sessionTimestamp: string;
  strengths: FeedbackItem[];
  improvements: FeedbackItem[];
  nextLevel: string;
  metrics: LeadershipMetrics[];
  agentPerformance: {
    strengths: string[];
    improvements: string[];
  };
}

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

export function saveUserProfile(nexusDir: string, profile: UserProfile): void {
  const profilePath = join(nexusDir, "user-profile.json");
  const dir = join(nexusDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(profilePath, JSON.stringify(profile, null, 2), "utf-8");
}

export interface SessionBehaviorData {
  totalSessions: number;
  successRate: number;
  avgDuration: number | null;
  rejectedRecommendations: number;
  acceptedRecommendations: number;
  frequentCommands: string[];
  failureAreas: string[];
  asksForExplanations: boolean;
}

export function inferProfile(
  nexusDir: string,
  behaviorData: SessionBehaviorData
): UserProfile {
  const currentProfile = loadUserProfile(nexusDir);

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

  let tone: FeedbackTone = currentProfile.tone;
  if (behaviorData.asksForExplanations && behaviorData.successRate < 0.5) {
    tone = "mentor";
  } else if (behaviorData.successRate >= 0.8 && leadership === "senior") {
    tone = "peer";
  }

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

export function updateProfileFromSession(
  nexusDir: string,
  outcome: SessionOutcome,
  followedRecommendations: boolean,
  durationMinutes: number | undefined
): UserProfile {
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

export function calibrateTone(
  profile: UserProfile,
  outcome: SessionOutcome,
  skillLevel: SkillLevel
): FeedbackTone {
  if (profile.tone === "mentor") return "mentor";
  if (profile.tone === "relatorio") return "relatorio";

  if (outcome === "failure" && skillLevel === "junior") {
    return "mentor";
  }
  if (outcome === "success" && skillLevel === "senior") {
    return "peer";
  }
  if (outcome === "failure" && skillLevel === "senior") {
    return "peer";
  }

  return profile.tone;
}

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
