/**
 * Shared helpers for upgrade sub-commands.
 */

import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import fse from "fs-extra";
import { getCapabilityFiles } from "../../capability-mapping.js";

const { copySync, ensureDirSync } = fse;

export function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "..", "..", "templates", "base");
}

export function installCapabilities(
  targetDir: string,
  capabilities: import("../../maturity-profile.js").Capability[]
): { filesInstalled: number; directoriesCreated: number } {
  const templatesDir = getTemplatesDir();
  let directoriesCreated = 0;
  let filesInstalled = 0;

  for (const cap of capabilities) {
    const files = getCapabilityFiles(cap);
    for (const file of files) {
      const srcPath = join(templatesDir, file.src);
      const destPath = join(targetDir, file.dest);
      if (existsSync(destPath) || !existsSync(srcPath)) continue;
      const dir = resolve(destPath, "..");
      if (!existsSync(dir)) { ensureDirSync(dir); directoriesCreated++; }
      copySync(srcPath, destPath);
      filesInstalled++;
    }
  }

  return { filesInstalled, directoriesCreated };
}
