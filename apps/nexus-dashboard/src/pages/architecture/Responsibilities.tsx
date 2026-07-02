import { Link } from 'react-router-dom'

const responsibilities = [
  { component: 'nexus-cli', responsibility: 'Interface de comandos, parsing de input, output formatado.' },
  { component: 'context_buffer.yaml', responsibility: 'Estado actual da sessao, tarefas, impedimentos, debt tecnico.' },
  { component: 'docs/history/', responsibility: 'Registo imutavel de sessoes passadas para consultas futuras.' },
  { component: 'maturity-profile.json', responsibility: 'Configuracao de maturidade, thresholds, e regras de scoring.' },
  { component: 'engineering-state/', responsibility: 'Estado detalhado por area: codigo, testes, docs, deploy.' },
  { component: 'telemetry/', responsibility: 'Snapshots periodicos para rastrear evolucao temporal.' },
  { component: 'governance/agents/', responsibility: 'Contratos que definem permissoes e comportamento dos agentes.' },
  { component: 'governance/knowledge-graph/', responsibility: 'Mapa de conceitos, relacoes e dependencias entre eles.' },
]

export default function Responsibilities() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Responsabilidades</h1>
        <p className="text-text-secondary max-w-2xl">
          Quem faz o que no Nexus System. Cada componente tem uma responsabilidade clara.
        </p>
      </section>

      <section className="space-y-3">
        <div className="space-y-2">
          {responsibilities.map(resp => (
            <div key={resp.component} className="layer-card">
              <h3 className="text-sm font-semibold text-accent font-mono">{resp.component}</h3>
              <p className="text-xs text-text-secondary mt-1">{resp.responsibility}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/architecture" className="block text-sm">→ Componentes</Link>
        <Link to="/architecture/dependencies" className="block text-sm">→ Dependencias</Link>
      </div>
    </div>
  )
}
