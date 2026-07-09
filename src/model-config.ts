/**
 * model-config.ts — Model-specific configuration
 *
 * Provides a registry of AI model configurations for optimal interaction.
 * Each model has specific capabilities and recommended parameters.
 *
 * PRINCIPLE: Tailor context to the model's strengths.
 */

import { logger } from "./logger.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ModelCapabilities {
  maxTokens: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsImages: boolean;
  contextWindow: number;
}

export interface ModelConfig {
  modelId: string;
  displayName: string;
  provider: string;
  capabilities: ModelCapabilities;
  recommendedContextLength: number;
  preferredOutputFormat: "json" | "markdown" | "text";
}

// ── Model Registry ──────────────────────────────────────────────────────────

const MODEL_REGISTRY: Map<string, ModelConfig> = new Map();

/**
 * Register a model configuration.
 */
export function registerModel(config: ModelConfig): void {
  MODEL_REGISTRY.set(config.modelId, config);
  logger.debug("model-config", `Registered model: ${config.displayName}`);
}

/**
 * Get model configuration.
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_REGISTRY.get(modelId);
}

/**
 * Get all registered models.
 */
export function getAllModels(): ModelConfig[] {
  return Array.from(MODEL_REGISTRY.values());
}

/**
 * Get recommended context length for a model.
 */
export function getRecommendedContextLength(modelId: string): number {
  const config = MODEL_REGISTRY.get(modelId);
  return config?.recommendedContextLength ?? 4000;
}

/**
 * Get preferred output format for a model.
 */
export function getPreferredOutputFormat(modelId: string): "json" | "markdown" | "text" {
  const config = MODEL_REGISTRY.get(modelId);
  return config?.preferredOutputFormat ?? "json";
}

// ── Default Models ──────────────────────────────────────────────────────────

/**
 * Initialize default model configurations.
 */
export function initializeDefaultModels(): void {
  registerModel({
    modelId: "claude-3-opus",
    displayName: "Claude 3 Opus",
    provider: "anthropic",
    capabilities: {
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsImages: false,
      contextWindow: 200000,
    },
    recommendedContextLength: 8000,
    preferredOutputFormat: "json",
  });

  registerModel({
    modelId: "claude-3-sonnet",
    displayName: "Claude 3 Sonnet",
    provider: "anthropic",
    capabilities: {
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsImages: false,
      contextWindow: 200000,
    },
    recommendedContextLength: 6000,
    preferredOutputFormat: "json",
  });

  registerModel({
    modelId: "gpt-4",
    displayName: "GPT-4",
    provider: "openai",
    capabilities: {
      maxTokens: 8192,
      supportsStreaming: true,
      supportsTools: true,
      supportsImages: true,
      contextWindow: 128000,
    },
    recommendedContextLength: 6000,
    preferredOutputFormat: "json",
  });

  registerModel({
    modelId: "gpt-4-turbo",
    displayName: "GPT-4 Turbo",
    provider: "openai",
    capabilities: {
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsImages: true,
      contextWindow: 128000,
    },
    recommendedContextLength: 8000,
    preferredOutputFormat: "json",
  });

  registerModel({
    modelId: "mimo-v2.5-free",
    displayName: "Mimo V2.5 Free",
    provider: "opencode",
    capabilities: {
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsImages: false,
      contextWindow: 32000,
    },
    recommendedContextLength: 4000,
    preferredOutputFormat: "json",
  });

  registerModel({
    modelId: "deepseek-v3",
    displayName: "DeepSeek V3",
    provider: "deepseek",
    capabilities: {
      maxTokens: 8192,
      supportsStreaming: true,
      supportsTools: true,
      supportsImages: false,
      contextWindow: 128000,
    },
    recommendedContextLength: 8000,
    preferredOutputFormat: "json",
  });

  logger.debug("model-config", `Initialized ${MODEL_REGISTRY.size} default models`);
}

// ── Auto-initialize ─────────────────────────────────────────────────────────

initializeDefaultModels();
