/**
 * mcp-install.test.ts — Tests for MCP Filesystem Server Installation Logic
 *
 * Tests installMcpServer with mocked execSync and updateOpenCodeJsonTimeout
 * with real temporary filesystem operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
import {
  installMcpServer,
  updateOpenCodeJsonTimeout,
} from "../mcp-install.js";

const mockExecSync = vi.mocked(execSync);

describe("installMcpServer", () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it("returns error for unsupported Node.js version", () => {
    const originalVersion = process.version;
    Object.defineProperty(process, "version", { value: "v16.0.0" });

    const result = installMcpServer();

    expect(result.installed).toBe(false);
    expect(result.errorCode).toBe("UNSUPPORTED_NODE");
    expect(result.error).toContain("too old");

    Object.defineProperty(process, "version", { value: originalVersion });
  });

  it("returns error when npm is not available", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("Command failed: npm --version");
    });

    const result = installMcpServer();

    expect(result.installed).toBe(false);
    expect(result.errorCode).toBe("NPM_NOT_FOUND");
  });

  it("returns check result when package is not installed", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockReturnValueOnce(JSON.stringify({ dependencies: {} })); // npm list

    const result = installMcpServer({ check: true });

    expect(result.installed).toBe(false);
    expect(result.version).toBeUndefined();
    expect(result.latestVersionCheckFailed).toBe(true);
  });

  it("returns check result when package is installed and up to date", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            "@modelcontextprotocol/server-filesystem": {
              version: "1.0.0",
            },
          },
        })
      ) // npm list
      .mockReturnValueOnce("1.0.0"); // npm view

    const result = installMcpServer({ check: true });

    expect(result.installed).toBe(true);
    expect(result.version).toBe("1.0.0");
    expect(result.upgrade).toBe(false);
    expect(result.latestVersionCheckFailed).toBe(false);
  });

  it("returns check result when upgrade is available", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            "@modelcontextprotocol/server-filesystem": {
              version: "0.9.0",
            },
          },
        })
      ) // npm list
      .mockReturnValueOnce("1.0.0"); // npm view

    const result = installMcpServer({ check: true });

    expect(result.installed).toBe(true);
    expect(result.version).toBe("0.9.0");
    expect(result.upgrade).toBe(true);
    expect(result.latestVersionCheckFailed).toBe(false);
  });

  it("returns check result when npm view fails", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            "@modelcontextprotocol/server-filesystem": {
              version: "1.0.0",
            },
          },
        })
      ) // npm list
      .mockImplementation(() => {
        throw new Error("npm view failed");
      }); // npm view fails

    const result = installMcpServer({ check: true });

    expect(result.installed).toBe(true);
    expect(result.version).toBe("1.0.0");
    expect(result.upgrade).toBe(false);
    expect(result.latestVersionCheckFailed).toBe(true);
  });

  it("returns success when already installed and up to date", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            "@modelcontextprotocol/server-filesystem": {
              version: "1.0.0",
            },
          },
        })
      ) // npm list
      .mockReturnValueOnce("1.0.0"); // npm view

    const result = installMcpServer();

    expect(result.installed).toBe(true);
    expect(result.version).toBe("1.0.0");
    expect(result.latestVersionCheckFailed).toBe(false);
  });

  it("returns success when already installed and upgrade requested but already latest", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            "@modelcontextprotocol/server-filesystem": {
              version: "1.0.0",
            },
          },
        })
      ) // npm list
      .mockReturnValueOnce("1.0.0"); // npm view

    const result = installMcpServer({ upgrade: true });

    expect(result.installed).toBe(true);
    expect(result.version).toBe("1.0.0");
    expect(result.upgrade).toBe(false);
    expect(result.latestVersionCheckFailed).toBe(false);
  });

  it("handles permission denied error", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockReturnValueOnce(
        JSON.stringify({
          dependencies: {},
        })
      ); // npm list

    // npm view succeeds
    mockExecSync
      .mockReturnValueOnce("1.0.0") // npm view
      .mockImplementationOnce(() => {
        const err = new Error("Command failed") as Error & { stderr: string; status: number };
        err.stderr = "EACCES: permission denied";
        err.status = 1;
        throw err;
      });

    const result = installMcpServer();

    expect(result.installed).toBe(false);
    expect(result.errorCode).toBe("PERMISSION_DENIED");
    expect(result.error).toContain("Permission denied");
  });

  it("handles generic install failure", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockReturnValueOnce(JSON.stringify({ dependencies: {} })) // npm list
      .mockReturnValueOnce("1.0.0") // npm view
      .mockImplementationOnce(() => {
        const err = new Error("Command failed") as Error & { stderr: string; status: number };
        err.stderr = "npm ERR! code E404";
        err.status = 1;
        throw err;
      });

    const result = installMcpServer();

    expect(result.installed).toBe(false);
    expect(result.errorCode).toBe("INSTALL_FAILED");
    expect(result.error).toContain("npm ERR!");
  });

  it("successfully installs the package", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockReturnValueOnce("") // npm list (not installed, may throw in real scenario)
      .mockReturnValueOnce("1.0.0") // npm view
      .mockReturnValueOnce("") // npm install -g (success)
      .mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            "@modelcontextprotocol/server-filesystem": {
              version: "1.0.0",
            },
          },
        })
      ); // npm list verify

    const result = installMcpServer();

    expect(result.installed).toBe(true);
    expect(result.version).toBe("1.0.0");
    expect(result.previousVersion).toBeUndefined();
  });

  it("handles npm list throwing when package not installed", () => {
    mockExecSync
      .mockReturnValueOnce("10.9.0") // npm --version
      .mockImplementationOnce(() => {
        throw new Error("npm list failed");
      }) // npm list throws
      .mockReturnValueOnce("1.0.0") // npm view
      .mockReturnValueOnce("") // npm install -g
      .mockReturnValueOnce(
        JSON.stringify({
          dependencies: {
            "@modelcontextprotocol/server-filesystem": {
              version: "1.0.0",
            },
          },
        })
      ); // verify

    const result = installMcpServer();

    expect(result.installed).toBe(true);
    expect(result.version).toBe("1.0.0");
  });
});

describe("updateOpenCodeJsonTimeout", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "mcp-install-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns error when opencode.json does not exist", () => {
    const result = updateOpenCodeJsonTimeout(tmpDir);

    expect(result.changed).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns error when mcp.local-filesystem is not configured", () => {
    writeFileSync(
      join(tmpDir, "opencode.json"),
      JSON.stringify({ agent: {} }),
      "utf-8"
    );

    const result = updateOpenCodeJsonTimeout(tmpDir);

    expect(result.changed).toBe(false);
    expect(result.error).toContain("MCP local-filesystem not found");
  });

  it("adds timeout when not present", () => {
    const config = {
      mcp: {
        "local-filesystem": {
          type: "local",
          command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."],
          enabled: true,
        },
      },
    };
    writeFileSync(
      join(tmpDir, "opencode.json"),
      JSON.stringify(config, null, 2) + "\n",
      "utf-8"
    );

    const result = updateOpenCodeJsonTimeout(tmpDir, 15000);

    expect(result.changed).toBe(true);

    const updated = JSON.parse(
      readFileSync(join(tmpDir, "opencode.json"), "utf-8")
    );
    expect(updated.mcp["local-filesystem"].timeout).toBe(15000);
  });

  it("does not change when timeout already matches", () => {
    const config = {
      mcp: {
        "local-filesystem": {
          type: "local",
          command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."],
          enabled: true,
          timeout: 15000,
        },
      },
    };
    writeFileSync(
      join(tmpDir, "opencode.json"),
      JSON.stringify(config, null, 2) + "\n",
      "utf-8"
    );

    const result = updateOpenCodeJsonTimeout(tmpDir, 15000);

    expect(result.changed).toBe(false);
  });

  it("updates timeout when different value exists", () => {
    const config = {
      mcp: {
        "local-filesystem": {
          type: "local",
          command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", "."],
          enabled: true,
          timeout: 5000,
        },
      },
    };
    writeFileSync(
      join(tmpDir, "opencode.json"),
      JSON.stringify(config, null, 2) + "\n",
      "utf-8"
    );

    const result = updateOpenCodeJsonTimeout(tmpDir, 30000);

    expect(result.changed).toBe(true);

    const updated = JSON.parse(
      readFileSync(join(tmpDir, "opencode.json"), "utf-8")
    );
    expect(updated.mcp["local-filesystem"].timeout).toBe(30000);
  });

  it("handles corrupted opencode.json gracefully", () => {
    writeFileSync(
      join(tmpDir, "opencode.json"),
      "this is not valid json",
      "utf-8"
    );

    const result = updateOpenCodeJsonTimeout(tmpDir);

    expect(result.changed).toBe(false);
    expect(result.error).toBeDefined();
  });
});
