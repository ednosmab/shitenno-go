import { Link } from 'react-router-dom'

const events = [
  { name: 'SessionStarted', description: 'Disparado quando uma nova sessao e iniciada.', layer: 'Session' },
  { name: 'SessionEnded', description: 'Disparado quando uma sessao e encerrada.', layer: 'Session' },
  { name: 'CapabilityInstalled', description: 'Disparado quando uma capability e instalada.', layer: 'Capabilities' },
  { name: 'CapabilityRemoved', description: 'Disparado quando uma capability e removida.', layer: 'Capabilities' },
  { name: 'MaturityChanged', description: 'Disparado quando o nivel de maturidade muda.', layer: 'Evolution' },
  { name: 'HealthDegraded', description: 'Disparado quando a saude do sistema degrada.', layer: 'Health' },
  { name: 'HealthRecovered', description: 'Disparado quando a saude do sistema recupera.', layer: 'Health' },
  { name: 'KnowledgeCreated', description: 'Disparado quando novo conhecimento e criado.', layer: 'Knowledge' },
  { name: 'KnowledgeArchived', description: 'Disparado quando conhecimento e arquivado.', layer: 'Knowledge' },
]

export default function Events() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Eventos</h1>
        <p className="text-text-secondary max-w-2xl">
          Eventos que o sistema emite quando ocorrem mudancas de estado relevantes.
        </p>
      </section>

      <section className="layer-card flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Event Bus</h2>
        <p className="text-sm text-text-secondary">
          O Nexus usa um event bus para comunicacao desacoplada entre componentes. Eventos sao disparados de forma sincrona ou assincrona.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Tipos de eventos</h2>
        <div className="flex flex-col gap-2">
          {events.map(evt => (
            <div key={evt.name} className="layer-card flex items-start gap-3">
              <code className="text-accent font-mono text-xs font-bold flex-shrink-0">{evt.name}</code>
              <div>
                <p className="text-xs text-text-secondary">{evt.description}</p>
                <span className="text-[10px] text-text-muted">{evt.layer}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts" className="block text-sm">→ Engineering State</Link>
        <Link to="/concepts/capabilities" className="block text-sm">→ Capabilities</Link>
        <Link to="/concepts/evolution" className="block text-sm">→ Evolucao</Link>
      </div>
    </div>
  )
}
