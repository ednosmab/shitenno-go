import { describe, it, expect } from "vitest";
import { shouldBlockInit } from "../commands/init.js";

describe("shouldBlockInit", () => {
  it("blocks when path contains nexus-cli", () => {
    expect(shouldBlockInit("/path/to/nexus-cli", false)).toBe(true);
  });

  it("blocks when path contains nexus-cli as segment", () => {
    expect(shouldBlockInit("/home/runner/work/nexus-cli/myproject", false)).toBe(true);
  });

  it("blocks /tmp/nexus-cli-testdir", () => {
    expect(shouldBlockInit("/tmp/nexus-cli-testdir", false)).toBe(true);
  });

  it("does not block regular project path", () => {
    expect(shouldBlockInit("/tmp/regular-project", false)).toBe(false);
  });

  it("does not block when force is true", () => {
    expect(shouldBlockInit("/path/to/nexus-cli", true)).toBe(false);
  });

  it("does not block path without nexus-cli", () => {
    expect(shouldBlockInit("/home/runner/work/nexus-system/nexus-system", false)).toBe(false);
  });
});
