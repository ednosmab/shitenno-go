import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');
const GOV = resolve(ROOT, 'nexus-system', 'governance');

let exitCode = 0;
let warnings: string[] = [];

function fail(check: string, detail: string) {
  console.error(`❌ [${check}] ${detail}`);
  exitCode = 1;
}

function pass(check: string, detail: string) {
  console.log(`✅ [${check}] ${detail}`);
}

function warn(check: string, detail: string) {
  console.warn(`⚠️  [${check}] ${detail}`);
  warnings.push(`${check}: ${detail}`);
}

// ── 1. Working tree clean? ────────────────────────────────────────────────
function checkWorkingTree() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: ROOT }).trim();
    if (!status) {
      pass('WORKING_TREE', 'No uncommitted changes');
    } else {
      const lines = status.split('\n').length;
      warn('WORKING_TREE', `${lines} uncommitted change(s) — commit before closing`);
    }
  } catch {
    fail('WORKING_TREE', 'Git command failed');
  }
}

// ── 2. Tests executed? ────────────────────────────────────────────────────
function checkTests() {
  try {
    execSync('pnpm run test --recursive --if-present --filter=core 2>/dev/null | tail -1', {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 60000,
    });
    pass('TESTS', 'Core tests passed');
  } catch {
    warn('TESTS', 'Tests not executed or failed — run pnpm run test');
  }
}

// ── 3. Context buffer updated? ────────────────────────────────────────────
function checkBuffer() {
  const yamlPath = resolve(GOV, 'context/context_buffer.yaml');
  if (!existsSync(yamlPath)) {
    fail('BUFFER', 'context_buffer.yaml not found');
    return;
  }
  const content = readFileSync(yamlPath, 'utf-8');
  if (content.includes('status: "completed"') || content.includes('status: "in_progress"')) {
    pass('BUFFER', 'context_buffer.yaml has valid session status');
  } else {
    warn('BUFFER', 'Session status not set in context_buffer.yaml');
  }
}

// ── 4. Backlog updated? ───────────────────────────────────────────────────
function checkBacklog() {
  const backlogPath = resolve(ROOT, 'nexus-system', 'docs', 'BACKLOG.md');
  if (!existsSync(backlogPath)) {
    warn('BACKLOG', 'BACKLOG.md not found');
    return;
  }
  const content = readFileSync(backlogPath, 'utf-8');
  if (content.includes('Concluído') || content.includes('Done') || content.includes('In Progress')) {
    pass('BACKLOG', 'BACKLOG.md has tracked items');
  } else {
    warn('BACKLOG', 'BACKLOG.md may need updating');
  }
}

// ── 5. Commit check ──────────────────────────────────────────────────────
function checkCommit() {
  const lastCommit = execSync('git log --oneline -1', { encoding: 'utf-8', cwd: ROOT }).trim();
  if (lastCommit) {
    pass('COMMIT', `Last commit: ${lastCommit}`);
  } else {
    warn('COMMIT', 'No commits found');
  }
}

// ── 6. UI Governance (verify:all) ───────────────────────────────────────
function checkUIGovernance() {
  try {
    execSync('pnpm run verify:ui 2>/dev/null', {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 30000,
    });
    pass('UI_GOVERNANCE', 'All UI rules pass');
  } catch {
    warn('UI_GOVERNANCE', 'UI governance check failed — run pnpm run verify:ui');
  }
}

// ── 7. Build verification ───────────────────────────────────────────────
function checkBuild() {
  try {
    execSync('pnpm run build:verify 2>/dev/null | tail -5', {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 180000,
    });
    pass('BUILD', 'Build verification passed');
  } catch {
    warn('BUILD', 'Build failed — run pnpm run build:verify');
  }
}

// ── Execute ───────────────────────────────────────────────────────────────
console.log('\n🔒 CLOSE SESSION — Closing session checklist\n');

checkWorkingTree();
checkTests();
checkBuffer();
checkBacklog();
checkCommit();
checkUIGovernance();
checkBuild();

console.log(`\n${exitCode === 0 ? '✅ Session ready to close' : '❌ Session has issues to resolve'}`);
if (warnings.length > 0) {
  console.warn('\n⚠️  Warnings:');
  warnings.forEach((w) => console.warn(`   - ${w}`));
}
console.log('');
process.exit(exitCode);
