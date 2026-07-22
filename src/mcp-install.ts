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

function parseInstalledVersion(
  json: string,
  packageName: string
): string | undefined {
  try {
    const parsed = JSON.parse(json);
    return parsed.dependencies?.[packageName]?.version;
  } catch {
    return undefined;
  }
}

function getCurrentVersion(packageName: string): string | undefined {
  const listResult = execSafe(`npm list -g ${packageName} --json`, {
    timeout: 15000,
  });
  if (listResult.exitCode === 0 && listResult.stdout) {
    return parseInstalledVersion(listResult.stdout, packageName);
  }
  return undefined;
}

function getLatestVersion(packageName: string): {
  version: string | undefined;
  failed: boolean;
} {
  const viewResult = execSafe(`npm view ${packageName} version`, {
    timeout: 15000,
  });
  if (viewResult.exitCode === 0 && viewResult.stdout) {
    return { version: viewResult.stdout, failed: false };
  }
  return { version: undefined, failed: true };
}

function runNpmInstall(
  packageName: string,
  tag: string
): { error?: string; errorCode?: string } | null {
  const installResult = execSafe(`npm install -g ${packageName}${tag}`, {
    timeout: 120000,
  });
  if (installResult.exitCode === 0) return null;
  const message = installResult.stderr || installResult.stdout;
  const action = tag ? "Upgrading" : "Installing";
  if (message.includes("EACCES") || message.includes("EPERM")) {
    return {
      error: `${action} failed: Permission denied.\n  Fix: npm config set prefix ~/.npm-global\n  Then add to PATH: export PATH=~/.npm-global/bin:$PATH`,
      errorCode: "PERMISSION_DENIED",
    };
  }
  return {
    error: `${action} failed: ${message}`,
    errorCode: "INSTALL_FAILED",
  };
}

function verifyInstalledVersion(
  packageName: string
): string | undefined {
  const verifyResult = execSafe(`npm list -g ${packageName} --json`, {
    timeout: 15000,
  });
  if (verifyResult.exitCode === 0 && verifyResult.stdout) {
    return parseInstalledVersion(verifyResult.stdout, packageName);
  }
  return undefined;
}

function checkPrerequisites(
  packageName: string,
  options: { check?: boolean; upgrade?: boolean }
): McpInstallResult | {
  currentVersion: string | undefined;
  latestVersion: string | undefined;
  latestVersionCheckFailed: boolean;
  shouldInstall: boolean;
} {
  const nodeMajor = getNodeMajorVersion();
  if (nodeMajor < 18) {
    return {
      installed: false,
      error: `Node.js ${process.version} is too old. Required: >=18`,
      errorCode: "UNSUPPORTED_NODE",
    };
  }

  const npmCheck = execSafe("npm --version", { timeout: 5000 });
  if (npmCheck.exitCode !== 0) {
    return {
      installed: false,
      error: "npm is not available or not responding",
      errorCode: "NPM_NOT_FOUND",
    };
  }

  const currentVersion = getCurrentVersion(packageName);
  const latest = getLatestVersion(packageName);
  const latestVersion = latest.version;
  const latestVersionCheckFailed = latest.failed;

  if (options.check) {
    return {
      installed: !!currentVersion,
      version: currentVersion,
      upgrade: !!(currentVersion && latestVersion && currentVersion !== latestVersion),
      latestVersionCheckFailed,
    };
  }

  const isOutdated = !!(currentVersion && latestVersion && currentVersion !== latestVersion);
  const shouldInstall =
    !currentVersion || (options.upgrade && isOutdated) || (!options.upgrade && isOutdated);

  if (!shouldInstall) {
    return {
      installed: true,
      version: currentVersion,
      ...(options.upgrade && latestVersion ? { upgrade: false } : {}),
      latestVersionCheckFailed,
    };
  }

  return { currentVersion, latestVersion, latestVersionCheckFailed, shouldInstall: true };
}

export function installMcpServer(
  options: { check?: boolean; upgrade?: boolean } = {}
): McpInstallResult {
  const packageName = "@modelcontextprotocol/server-filesystem";
  const preReq = checkPrerequisites(packageName, options);

  if ("installed" in preReq) return preReq;

  const tag = options.upgrade && preReq.latestVersion ? `@${preReq.latestVersion}` : "";
  const installError = runNpmInstall(packageName, tag);
  if (installError) {
    return { installed: false, ...installError, latestVersionCheckFailed: preReq.latestVersionCheckFailed } as McpInstallResult;
  }

  const newVersion = verifyInstalledVersion(packageName);
  return {
    installed: true,
    version: newVersion || preReq.latestVersion || "unknown",
    previousVersion: preReq.currentVersion,
    upgrade: options.upgrade,
    latestVersionCheckFailed: preReq.latestVersionCheckFailed,
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
      error: "opencode.json not found. Run 'shugo init' first.",
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
          "Add it manually or use this project with Shugo.",
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


