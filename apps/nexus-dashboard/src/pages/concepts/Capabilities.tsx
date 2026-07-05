import { Link } from 'react-router-dom'

const capabilities = [
  { name: 'Context Detection', description: 'Detecta automaticamente o contexto do projecto.', status: 'active' },
  { name: 'Profile Generation', description: 'Gera o nexus-profile com configuracoes especificas.', status: 'active' },
  { name: 'Health Monitoring', description: 'Monitora a saude da governanca continuamente.', status: 'active' },
  { name: 'Complexity Scoring', description: 'Calcula scores de complexidade por area.', status: 'active' },
  { name: 'Pattern Detection', description: 'Detecta padroes de codigo e comportamento.', status: 'active' },
  { name: 'Session Management', description: 'Gerencia sessoes de desenvolvimento.', status: 'active' },
  { name: 'Knowledge Lifecycle', description: 'Gerencia o ciclo de vida do conhecimento.', status: 'active' },
  { name: 'Governance Automation', description: 'Automatiza regras de governanca.', status: 'active' },
  { name: 'Evolution Tracking', description: 'Rastreia a evolucao do sistema.', status: 'active' },
]

const lifecycle = ['Detectar', 'Instalar', 'Configurar', 'Monitorar', 'Reportar', 'Evolver']

export default function Capabilities() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Capabilities</h1>
        <p className="text-text-secondary max-w-2xl">
          As 9 capacidades do Nexus System. Cada uma serve a um proposito especifico.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Capacidades ativas</h2>
        <div className="flex flex-col gap-2">
          {capabilities.map(cap => (
            <div key={cap.name} className="layer-card flex items-start gap-3">
              <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cap.status === 'active' ? 'bg-success' : 'bg-text-muted'}`} />
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{cap.name}</h3>
                <p className="text-xs text-text-secondary">{cap.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="layer-card flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Lifecycle</h2>
        <div className="flex flex-wrap gap-2">
          {lifecycle.map(stage => (
            <span key={stage} className="px-3 py-1.5 rounded-full bg-surface-2 text-xs text-text-secondary">{stage}</span>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts" className="block text-sm">→ Engineering State</Link>
        <Link to="/concepts/esm" className="block text-sm">→ ESM</Link>
        <Link to="/concepts/evolution" className="block text-sm">→ Evolucao</Link>
      </div>
    </div>
  )
}
