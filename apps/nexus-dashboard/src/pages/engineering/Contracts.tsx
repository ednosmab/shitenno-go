import { Link } from 'react-router-dom'

const contracts = [
  {
    name: 'AI-CONTRACT-planner-v1',
    role: 'Planner',
    objective: 'Analisar requisitos, planear arquitetura, gerar planos de execucao.',
    allowed: ['Analisar documentacao', 'Sugerir ADRs', 'Escrever planos'],
    restricted: ['Escrever codigo', 'Modificar dependencias', 'Fazer commits'],
  },
  {
    name: 'AI-CONTRACT-executor-v1',
    role: 'Executor',
    objective: 'Implementar planos aprovados, step a step, sem alterar escopo.',
    allowed: ['Escrever/editar codigo', 'Rodar verificacoes', 'Marcar steps'],
    restricted: ['Expandir escopo', 'Mudar regras', 'Fazer commits sem gatilho'],
  },
  {
    name: 'AI-CONTRACT-reviewer-v1',
    role: 'Reviewer',
    objective: 'Auditar qualidade do codigo, garantir conformidade com padroes.',
    allowed: ['Executar testes', 'Executar linters', 'Rejeitar codigo'],
    restricted: ['Escrever codigo', 'Aprovar com testes quebrados', 'Modificar historico'],
  },
  {
    name: 'AI-CONTRACT-orchestrator-v1',
    role: 'Orchestrator',
    objective: 'Decidir qual papel actua em seguida e se uma tarefa pode avancar.',
    allowed: ['Ler estado', 'Decidir roteamento', 'Bloquear avanco', 'Registrar decisoes'],
    restricted: ['Escrever codigo', 'Aprovar conteudo', 'Pular PREMORTEM'],
  },
]

export default function Contracts() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Contratos</h1>
        <p className="text-text-secondary max-w-2xl">
          4 contratos que definem o comportamento, permissoes e restricoes de cada agente IA.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        {contracts.map(contract => (
          <div key={contract.name} className="layer-card space-y-3">
            <div className="flex items-center gap-2">
              <code className="text-accent font-mono text-xs font-bold">{contract.name}</code>
              <span className="px-2 py-0.5 rounded bg-surface-2 text-[10px] text-text-muted">{contract.role}</span>
            </div>
            <p className="text-sm text-text-secondary">{contract.objective}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-medium text-neon mb-1">Permitido</div>
                <ul className="text-xs text-text-secondary flex flex-col gap-0 .5">
                  {contract.allowed.map(a => <li key={a}>✓ {a}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-xs font-medium text-danger mb-1">Restrito</div>
                <ul className="text-xs text-text-secondary flex flex-col gap-0 .5">
                  {contract.restricted.map(r => <li key={r}>✗ {r}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts/governance" className="block text-sm">→ Governanca</Link>
        <Link to="/reference/contracts" className="block text-sm">→ Contratos (Referencia)</Link>
      </div>
    </div>
  )
}
