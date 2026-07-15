/**
 * Test setup — fail on unexpected console output.
 *
 * Any console.error or console.warn during a test that is NOT mocked
 * will cause that test to fail. This enforces the pattern:
 *   "If you know an error will happen, mock it explicitly."
 *
 * See docs/TESTING-PATTERNS.md for the full convention.
 */
import failOnConsole from "vitest-fail-on-console";

failOnConsole({
  shouldFailOnError: true,
  shouldFailOnWarn: true,
});
