import { Link } from 'react-router-dom'

const dependencies = [
  { from: 'nexus-cli', to: 'context_buffer.yaml', type: 'read/write' },
  { from: 'nexus-cli', to: 'maturity-profile.json', type: 'read' },
  { from: 'nexus-cli', to: 'engineering-state/', type: 'read/write' },
  { from: 'nexus-cli', to: 'telemetry/', type: 'write' },
  { from: 'nexus-cli', to: 'governance/agents/', type: 'read' },
  { from: 'context_buffer.yaml', to: 'docs/history/', type: 'archive' },
  { from: 'governance/agents/', to: 'governance/knowledge-graph/', type: 'read' },
  { from: 'telemetry/', to: 'maturity-profile.json', type: 'read' },
]

export default function Dependencies() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Dependencias</h1>
        <p className="text-text-secondary max-w-2xl">
          Mapa de dependencias entre componentes do Nexus System.
        </p>
      </section>

      <section className="layer-card flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Grafo de dependencias</h2>
        <p className="text-sm text-text-secondary">
          Dependencias devem sempre apontar "para dentro" (em direcao ao nucleo). Componentes externos dependem de componentes internos, nunca o inverso.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Relacoes</h2>
        <div className="flex flex-col gap-2">
          {dependencies.map((dep, i) => (
            <div key={i} className="layer-card flex items-center gap-3">
              <code className="text-accent font-mono text-xs">{dep.from}</code>
              <span className="text-text-muted text-xs">→</span>
              <code className="text-neon font-mono text-xs">{dep.to}</code>
              <span className="ml-auto px-2 py-0.5 rounded bg-surface-2 text-[10px] text-text-muted">{dep.type}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/architecture" className="block text-sm">→ Componentes</Link>
        <Link to="/architecture/responsibilities" className="block text-sm">→ Responsabilidades</Link>
      </div>
    </div>
  )
}
