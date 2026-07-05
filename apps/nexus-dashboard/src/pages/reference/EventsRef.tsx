import { Link } from 'react-router-dom'

const eventTypes = [
  { name: 'SessionStarted', payload: '{ sessionId: string, timestamp: string }', layer: 'Session' },
  { name: 'SessionEnded', payload: '{ sessionId: string, duration: number, outcome: string }', layer: 'Session' },
  { name: 'CapabilityInstalled', payload: '{ capability: string, version: string }', layer: 'Capabilities' },
  { name: 'CapabilityRemoved', payload: '{ capability: string, reason: string }', layer: 'Capabilities' },
  { name: 'MaturityChanged', payload: '{ from: number, to: number, area: string }', layer: 'Evolution' },
  { name: 'HealthDegraded', payload: '{ area: string, score: number, threshold: number }', layer: 'Health' },
  { name: 'HealthRecovered', payload: '{ area: string, score: number }', layer: 'Health' },
  { name: 'KnowledgeCreated', payload: '{ type: string, id: string, source: string }', layer: 'Knowledge' },
  { name: 'KnowledgeArchived', payload: '{ type: string, id: string, reason: string }', layer: 'Knowledge' },
]

export default function EventsRef() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Eventos — Referencia</h1>
        <p className="text-text-secondary max-w-2xl">
          Schema dos eventos emitidos pelo Nexus System.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {eventTypes.map(evt => (
            <div key={evt.name} className="layer-card space-y-2">
              <div className="flex items-center gap-2">
                <code className="text-accent font-mono text-xs font-bold">{evt.name}</code>
                <span className="px-2 py-0.5 rounded bg-surface-2 text-[10px] text-text-muted">{evt.layer}</span>
              </div>
              <div className="command-block text-[10px]">{evt.payload}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts/events" className="block text-sm">→ Eventos (Conceitos)</Link>
        <Link to="/concepts/capabilities" className="block text-sm">→ Capabilities</Link>
      </div>
    </div>
  )
}
