/**
 * mcp-install.ts — MCP Filesystem Server Installation Logic
 *
 * Handles global installation of @modelcontextprotocol/server-filesystem
 * and opencode.json timeout configuration.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface McpInstallResult {
  installed: boolean;
  version?: string;
  previousVersion?: string;
  upgrade?: boolean;
  error?: string;
  errorCode?: string;
  latestVersionCheckFailed?: boolean;
}

function getNodeMajorVersion(): number {
  const match = process.version.match(/^v(\d+)/);
  return match && match[1] ? parseInt(match[1], 10) : 0;
}

function execSafe(
  command: string,
  options: { timeout?: number } = {}
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(command, {
      stdio: "pipe",
      timeout: options.timeout ?? 30000,
      encoding: "utf-8",
    });
    return { stdout: stdout.trim(), stderr: "", exitCode: 0 };
  } catch (error) {
    const execError = error as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      status?: number;
    };
    return {
      stdout: String(execError.stdout ?? ""),
      stderr: String(execError.stderr ?? ""),
      exitCode: execError.status ?? 1,
    };
  }
}

export function installMcpServer(
  options: {
    check?: boolean;
    upgrade?: boolean;
  } = {}
): McpInstallResult {
  const packageName = "@modelcontextprotocol/server-filesystem";

  // Check node version
  const nodeMajor = getNodeMajorVersion();
  if (nodeMajor < 18) {
    return {
      installed: false,
      error: `Node.js ${process.version} is too old. Required: >=18`,
      errorCode: "UNSUPPORTED_NODE",
    };
  }

  // Check npm availability
  const npmCheck = execSafe("npm --version", { timeout: 5000 });
  if (npmCheck.exitCode !== 0) {
    return {
      installed: false,
      error: "npm is not available or not responding",
      errorCode: "NPM_NOT_FOUND",
    };
  }

  // Check current installed version
  let currentVersion: string | undefined;
  const listResult = execSafe(`npm list -g ${packageName} --json`, {
    timeout: 15000,
  });
  if (listResult.exitCode === 0 && listResult.stdout) {
    try {
      const parsed = JSON.parse(listResult.stdout);
      const pkg = parsed.dependencies?.[packageName];
      if (pkg?.version) {
        currentVersion = pkg.version;
      }
    } catch {
      currentVersion = undefined;
    }
  }

  // Check latest available version
  let latestVersion: string | undefined;
  let latestVersionCheckFailed = false;
  const viewResult = execSafe(`npm view ${packageName} version`, {
    timeout: 15000,
  });
  if (viewResult.exitCode === 0 && viewResult.stdout) {
    latestVersion = viewResult.stdout;
  } else {
    latestVersionCheckFailed = true;
  }

  // Check-only mode
  if (options.check) {
    return {
      installed: !!currentVersion,
      version: currentVersion,
      upgrade: !!(
        currentVersion &&
        latestVersion &&
        currentVersion !== latestVersion
      ),
      latestVersionCheckFailed,
    };
  }

  const isOutdated =
    currentVersion &&
    latestVersion &&
    currentVersion !== latestVersion;

  // Already installed and up to date, no upgrade requested
  if (currentVersion && !options.upgrade && !isOutdated) {
    return {
      installed: true,
      version: currentVersion,
      latestVersionCheckFailed,
    };
  }

  // Already installed and upgrade requested, but already latest
  if (currentVersion && options.upgrade && latestVersion && !isOutdated) {
    return {
      installed: true,
      version: currentVersion,
      upgrade: false,
      latestVersionCheckFailed,
    };
  }

  // Install or upgrade
  const tag =
    options.upgrade && latestVersion ? `@${latestVersion}` : "";
  const action = options.upgrade ? "Upgrading" : "Installing";

  const installResult = execSafe(
    `npm install -g ${packageName}${tag}`,
    { timeout: 120000 }
  );

  if (installResult.exitCode !== 0) {
    const message = installResult.stderr || installResult.stdout;

    if (
      message.includes("EACCES") ||
      message.includes("EPERM")
    ) {
      return {
        installed: false,
        error: `${action} failed: Permission denied.\n  Fix: npm config set prefix ~/.npm-global\n  Then add to PATH: export PATH=~/.npm-global/bin:$PATH`,
        errorCode: "PERMISSION_DENIED",
        latestVersionCheckFailed,
      };
    }

    return {
      installed: false,
      error: `${action} failed: ${message}`,
      errorCode: "INSTALL_FAILED",
      latestVersionCheckFailed,
    };
  }

  // Verify installation
  const verifyResult = execSafe(
    `npm list -g ${packageName} --json`,
    { timeout: 15000 }
  );
  let newVersion: string | undefined;
  if (verifyResult.exitCode === 0 && verifyResult.stdout) {
    try {
      const parsed = JSON.parse(verifyResult.stdout);
      const pkg = parsed.dependencies?.[packageName];
      if (pkg?.version) {
        newVersion = pkg.version;
      }
    } catch {
      newVersion = undefined;
    }
  }

  return {
    installed: true,
    version: newVersion || latestVersion || "unknown",
    previousVersion: currentVersion,
    upgrade: options.upgrade,
    latestVersionCheckFailed,
  };
}

export function updateOpenCodeJsonTimeout(
  projectRoot: string,
  timeoutMs: number = 15000
): { changed: boolean; error?: string } {
  const opencodePath = join(projectRoot, "opencode.json");
  if (!existsSync(opencodePath)) {
    return {
      changed: false,
      error: "opencode.json not found. Run 'nexus init' first.",
    };
  }

  try {
    const content = readFileSync(opencodePath, "utf-8");
    const config = JSON.parse(content);

    if (
      !config.mcp?.["local-filesystem"]
    ) {
      return {
        changed: false,
        error:
          "MCP local-filesystem not found in opencode.json. " +
          "Add it manually or use this project with Nexus.",
      };
    }

    if (config.mcp["local-filesystem"].timeout === timeoutMs) {
      return { changed: false }; // Already configured
    }

    config.mcp["local-filesystem"].timeout = timeoutMs;
    writeFileSync(
      opencodePath,
      JSON.stringify(config, null, 2) + "\n",
      "utf-8"
    );
    return { changed: true };
  } catch (error) {
    return {
      changed: false,
      error: `Failed to update opencode.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}


