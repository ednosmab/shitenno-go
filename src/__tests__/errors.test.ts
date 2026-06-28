import { describe, it, expect } from "vitest";
import {
  NexusError,
  NotInitializedError,
  InvalidRuleError,
  ScriptNotAllowedError,
} from "../errors.js";

describe("NexusError", () => {
  it("has name, message, and code", () => {
    const err = new NexusError("something broke", "E_FAIL");
    expect(err.name).toBe("NexusError");
    expect(err.message).toBe("something broke");
    expect(err.code).toBe("E_FAIL");
    expect(err.exitCode).toBe(1);
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts custom exitCode", () => {
    const err = new NexusError("fail", "E_FAIL", 2);
    expect(err.exitCode).toBe(2);
  });
});

describe("NotInitializedError", () => {
  it("is a NexusError with default message", () => {
    const err = new NotInitializedError();
    expect(err).toBeInstanceOf(NexusError);
    expect(err.name).toBe("NexusError");
    expect(err.code).toBe("NOT_INITIALIZED");
    expect(err.message).toContain("not initialized");
  });
});

describe("InvalidRuleError", () => {
  it("is a NexusError", () => {
    const err = new InvalidRuleError("bad rule");
    expect(err).toBeInstanceOf(NexusError);
    expect(err.code).toBe("INVALID_RULE");
    expect(err.message).toContain("bad rule");
  });
});

describe("ScriptNotAllowedError", () => {
  it("is a NexusError", () => {
    const err = new ScriptNotAllowedError("evil.sh");
    expect(err).toBeInstanceOf(NexusError);
    expect(err.code).toBe("SCRIPT_NOT_ALLOWED");
    expect(err.message).toContain("evil.sh");
  });
});
