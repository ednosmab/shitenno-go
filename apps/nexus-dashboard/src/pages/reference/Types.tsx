import { Link } from 'react-router-dom'

const types = [
  {
    name: 'Session',
    definition: `{ id: string; started_at: string; status: "active" | "completed"; current_task: CurrentTask; documents_loaded: DocumentLoaded[]; impediments: string[]; technical_debt: string[]; completed_tasks: CompletedTask[]; model_assignments: ModelAssignments; }`,
  },
  {
    name: 'CurrentTask',
    definition: `{ id: string; description: string; status: string; started_at: string; completed_at?: string; }`,
  },
  {
    name: 'DocumentLoaded',
    definition: `{ path: string; loaded_at: string; }`,
  },
  {
    name: 'CompletedTask',
    definition: `{ id: string; description: string; completed_at: string; files_created?: string[]; files_modified?: string[]; }`,
  },
  {
    name: 'ModelAssignments',
    definition: `{ planner: string; executor: string; reviewer: string; }`,
  },
  {
    name: 'MaturityProfile',
    definition: `{ version: string; maturity_level: number; capabilities: string[]; thresholds: Record<string, number>; }`,
  },
]

export default function Types() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Tipos</h1>
        <p className="text-text-secondary max-w-2xl">
          Definicoes de tipos TypeScript usados no Nexus System.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        {types.map(type => (
          <div key={type.name} className="layer-card space-y-2">
            <h3 className="text-sm font-semibold text-accent font-mono">{type.name}</h3>
            <div className="command-block text-[10px] whitespace-pre-wrap">{type.definition}</div>
          </div>
        ))}
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/engineering/interfaces" className="block text-sm">→ Interfaces (Engenharia)</Link>
        <Link to="/reference/schemas" className="block text-sm">→ Esquemas</Link>
      </div>
    </div>
  )
}
