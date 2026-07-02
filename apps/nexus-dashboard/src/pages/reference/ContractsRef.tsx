import { Link } from 'react-router-dom'

const contractSchema = {
  agent: {
    name: 'string — nome unico do contrato',
    role: 'string — Planner | Executor | Reviewer | Orchestrator',
    objective: 'string — objectivo principal do agente',
    inputs: 'array — tipo e formato dos dados de entrada',
    outputs: 'array — artifact e schema gerado',
    allowed_actions: 'array — accoes permitidas',
    restricted_actions: 'array — accoes proibidas',
    allowed_tools: 'array — ferramentas acessiveis',
    handoff: 'object — incoming e outgoing',
    failure_policy: 'object — retry e escalation',
  },
}

export default function ContractsRef() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Contratos — Referencia</h1>
        <p className="text-text-secondary max-w-2xl">
          Schema dos contratos de agentes IA do Nexus System.
        </p>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Schema do contrato</h2>
        <div className="space-y-1">
          {Object.entries(contractSchema.agent).map(([field, type]) => (
            <div key={field} className="flex items-center gap-2 py-1">
              <code className="text-accent text-xs font-mono">{field}</code>
              <span className="text-[10px] text-text-muted">{type}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Exemplo</h2>
        <div className="command-block text-[10px] whitespace-pre-wrap">
{`agent:
  name: AI-CONTRACT-planner-v1
  role: Planner
  objective: Analisar requisitos e gerar planos
  allowed_actions:
    - Analisar documentacao
    - Escrever planos
  restricted_actions:
    - Escrever codigo
    - Fazer commits`}
        </div>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/engineering/contracts" className="block text-sm">→ Contratos (Engenharia)</Link>
        <Link to="/concepts/governance" className="block text-sm">→ Governanca</Link>
      </div>
    </div>
  )
}
