import { Link } from 'react-router-dom'

const interfaces = [
  { name: 'Session', fields: ['id', 'started_at', 'status', 'current_task', 'documents_loaded', 'impediments'] },
  { name: 'CurrentTask', fields: ['id', 'description', 'status', 'started_at', 'completed_at'] },
  { name: 'DocumentLoaded', fields: ['path', 'loaded_at'] },
  { name: 'CompletedTask', fields: ['id', 'description', 'completed_at', 'files_created', 'files_modified'] },
  { name: 'ModelAssignments', fields: ['planner', 'executor', 'reviewer'] },
  { name: 'MaturityProfile', fields: ['version', 'maturity_level', 'capabilities', 'thresholds'] },
  { name: 'Fingerprint', fields: ['version', 'created_at', 'stack', 'project_type'] },
  { name: 'OperationalState', fields: ['version', 'state', 'transitions', 'current_phase'] },
]

export default function Interfaces() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Interfaces</h1>
        <p className="text-text-secondary max-w-2xl">
          Tipos e interfaces principais usados no Nexus System.
        </p>
      </section>

      <section className="space-y-4">
        {interfaces.map(iface => (
          <div key={iface.name} className="layer-card space-y-2">
            <h3 className="text-sm font-semibold text-accent font-mono">{iface.name}</h3>
            <div className="flex flex-wrap gap-1">
              {iface.fields.map(f => (
                <span key={f} className="px-2 py-0.5 rounded bg-surface-2 text-[10px] text-text-secondary font-mono">{f}</span>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/reference/types" className="block text-sm">→ Tipos (Referencia)</Link>
        <Link to="/engineering/contracts" className="block text-sm">→ Contratos</Link>
      </div>
    </div>
  )
}
