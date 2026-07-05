import { Link } from 'react-router-dom'

const components = [
  { name: 'nexus-cli', type: 'CLI', description: 'Interface de linha de comandos para interacao directa.', layer: 'UI' },
  { name: 'context_buffer.yaml', type: 'State', description: 'RAM do sistema. Estado operacional da sessao actual.', layer: 'State' },
  { name: 'docs/history/', type: 'Storage', description: 'ROM do sistema. Historico imutavel de sessoes.', layer: 'Storage' },
  { name: 'maturity-profile.json', type: 'Config', description: 'Perfil de maturidade do projecto.', layer: 'Config' },
  { name: 'engineering-state/', type: 'State', description: 'Estado detalhado da engenharia.', layer: 'State' },
  { name: 'telemetry/', type: 'Data', description: 'Snapshots periodicos de maturidade e complexidade.', layer: 'Data' },
  { name: 'governance/agents/', type: 'Config', description: 'Contratos dos agentes IA.', layer: 'Config' },
  { name: 'governance/knowledge-graph/', type: 'Data', description: 'Grafo de conceitos e relacoes.', layer: 'Data' },
]

export default function Components() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Componentes</h1>
        <p className="text-text-secondary max-w-2xl">
          Todos os componentes que formam o Nexus System e suas responsabilidades.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {components.map(comp => (
            <div key={comp.name} className="layer-card flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-surface-2 text-[10px] text-text-muted font-mono flex-shrink-0">{comp.type}</span>
              <div>
                <h3 className="text-sm font-semibold text-text-primary font-mono">{comp.name}</h3>
                <p className="text-xs text-text-secondary">{comp.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/architecture/responsibilities" className="block text-sm">→ Responsabilidades</Link>
        <Link to="/architecture/dependencies" className="block text-sm">→ Dependencias</Link>
        <Link to="/architecture/flows" className="block text-sm">→ Fluxos</Link>
      </div>
    </div>
  )
}
