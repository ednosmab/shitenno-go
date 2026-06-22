import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const ADR_DIR = resolve(ROOT, 'docs/adrs');

let exitCode = 0;

function pass(check: string, detail: string) {
  console.log(`✅ [${check}] ${detail}`);
}

function fail(check: string, detail: string) {
  console.error(`❌ [${check}] ${detail}`);
  exitCode = 1;
}

function warn(check: string, detail: string) {
  console.warn(`⚠️  [${check}] ${detail}`);
}

console.log('\n🧠 PREMORTEM CHECK — Identificando riscos antes de codificar\n');

// ── 1. What can break? ─────────────────────────────────────────────────────
warn('BREAKAGE', 'Identifique componentes, serviços ou fluxos que podem ser afectados');
warn('BREAKAGE', 'Consulte o WORKFLOW.md para o tipo de operação e use git diff para ver o escopo');

// ── 2. Related ADR? ───────────────────────────────────────────────────────
if (existsSync(ADR_DIR)) {
  pass('ADR_CHECK', 'Diretório docs/adrs/ existe — consulte manualmente para decisões relacionadas');
} else {
  fail('ADR_CHECK', 'Diretório docs/adrs/ não encontrado');
}

// ── 3. Insufficient context? ──────────────────────────────────────────────
warn('CONTEXT', 'Verifique se o plano cobre todos os cenários e se há ambiguidades');
warn('CONTEXT', 'Consulte context_buffer.yaml e o plano activo em docs/plans/');

// ── 4. Regression risk? ───────────────────────────────────────────────────
warn('REGRESSION', 'Identifique testes existentes que podem falhar');
warn('REGRESSION', 'Execute pnpm run test antes de começar para confirmar baseline verde');

// ── 5. External dependency? ───────────────────────────────────────────────
warn('DEPENDENCY', 'Verifique se há dependências de API, migration, configuração, deploy ou permissões');

// ── 6. Architectural impact? ──────────────────────────────────────────────
warn('ARCHITECTURE', 'Se houver impacto arquitectural, crie um ADR');
warn('ARCHITECTURE', 'Consulte a SYSTEM_MAP.md para o mapa central');

console.log(`\n${exitCode === 0 ? '✅ Premortem completed — review warnings above' : '❌ Premortem found issues'}\n`);
process.exit(exitCode);
