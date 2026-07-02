import { Link } from 'react-router-dom'

const maturities = [
  { level: 0, name: 'Initial', description: 'Processos ad-hoc e caoticos.' },
  { level: 1, name: 'Repeatable', description: 'Processos basicos sao estabelecidos.' },
  { level: 2, name: 'Defined', description: 'Processos documentados e padronizados.' },
  { level: 3, name: 'Managed', description: 'Processos medidos e controlados.' },
  { level: 4, name: 'Optimizing', description: 'Melhoria continua baseada em dados.' },
]

export default function Evolution() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Evolucao</h1>
        <p className="text-text-secondary max-w-2xl">
          Como o Nexus System evolui ao longo do tempo e acompanha a maturidade do projeto.
        </p>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Niveis de maturidade</h2>
        <div className="space-y-2">
          {maturities.map(m => (
            <div key={m.level} className="layer-card flex items-start gap-3">
              <span className="law-number">{m.level}</span>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{m.name}</h3>
                <p className="text-xs text-text-secondary">{m.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Adaptabilidade</h2>
        <p className="text-sm text-text-secondary">
          O Nexus adapta-se automaticamente ao contexto do projeto. Conforme o projeto evolui, o framework ajusta as regras, capabilities e recomendacoes.
        </p>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Telemetria</h2>
        <p className="text-sm text-text-secondary">
          Snapshots periodicos sao gravados em <code className="text-accent">telemetry/</code> para rastrear a evolucao da maturidade ao longo do tempo.
        </p>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts" className="block text-sm">→ Engineering State</Link>
        <Link to="/concepts/esm" className="block text-sm">→ ESM</Link>
        <Link to="/concepts/capabilities" className="block text-sm">→ Capabilities</Link>
      </div>
    </div>
  )
}
