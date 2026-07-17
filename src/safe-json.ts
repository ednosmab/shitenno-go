/**
 * safe-json.ts — Safe JSON parsing with validation
 *
 * Provides `safeJsonParse` and `safeJsonParseFile` helpers that catch
 * parse errors AND validate the parsed shape, returning null on failure
 * instead of throwing unhandled exceptions.
 *
 * Used as the standard replacement for raw JSON.parse() across the codebase,
 * particularly at trust boundaries (file I/O, daemon state, audit output).
 */

import { existsSync, readFileSync } from "node:fs";
import { logger } from "./logger.js";

/**
 * Parse a JSON string with a type guard validation function.
 * Returns null if parsing fails or validation fails.
 *
 * @param raw - The raw JSON string
 * @param validate - Type guard that returns true if the parsed value has the expected shape
 * @param context - Description for logging (e.g. "action-engine:execution-record")
 * @returns The validated value, or null on failure
 */
export function safeJsonParse<T>(
  raw: string,
  validate: (v: unknown) => v is T,
  context: string
): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("safe-json", `Failed to parse JSON in ${context}`);
    return null;
  }
  if (!validate(parsed)) {
    logger.warn("safe-json", `Shape validation failed in ${context}`);
    return null;
  }
  return parsed;
}

/**
 * Read a JSON file and parse it with validation.
 * Returns null if the file doesn't exist, can't be read, or validation fails.
 *
 * @param filePath - Path to the JSON file
 * @param validate - Type guard for the expected shape
 * @param context - Description for logging
 * @returns The validated value, or null on failure
 */
export function safeJsonParseFile<T>(
  filePath: string,
  validate: (v: unknown) => v is T,
  context: string
): T | null {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, "utf-8");
    return safeJsonParse(raw, validate, context);
  } catch {
    logger.warn("safe-json", `Failed to read file in ${context}: ${filePath}`);
    return null;
  }
}

// ── Common validators ──────────────────────────────────────────────────────

/**
 * Validate that a value is a plain object with optional shape check.
 */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate that a value is a non-empty string.
 */
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * Validate that a value is an array.
 */
export function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}
