import { Link } from 'react-router-dom'

const schemas = [
  {
    name: 'context_buffer.yaml',
    fields: [
      { key: 'session', type: 'object', description: 'Metadados da sessao actual.' },
      { key: 'current_task', type: 'object', description: 'Tarefa em curso.' },
      { key: 'documents_loaded', type: 'array', description: 'Documentos carregados via MCP.' },
      { key: 'impediments', type: 'array', description: 'Impedimentos activos.' },
      { key: 'technical_debt', type: 'array', description: 'Divida tecnica identificada.' },
      { key: 'completed_tasks', type: 'array', description: 'Tarefas concluidas na sessao.' },
      { key: 'model_assignments', type: 'object', description: 'Modelos atribuidos a cada papel.' },
    ],
  },
  {
    name: 'maturity-profile.json',
    fields: [
      { key: 'version', type: 'string', description: 'Versao do schema.' },
      { key: 'maturity_level', type: 'number', description: 'Nivel actual (0-4).' },
      { key: 'capabilities', type: 'array', description: 'Capabilities activas.' },
      { key: 'thresholds', type: 'object', description: 'Limites para scoring.' },
    ],
  },
  {
    name: 'fingerprint.json',
    fields: [
      { key: 'version', type: 'string', description: 'Versao do fingerprint.' },
      { key: 'created_at', type: 'string', description: 'Data de criacao.' },
      { key: 'stack', type: 'object', description: 'Stack tecnologico detectado.' },
      { key: 'project_type', type: 'string', description: 'Tipo de projecto.' },
    ],
  },
]

export default function Schemas() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Esquemas</h1>
        <p className="text-text-secondary max-w-2xl">
          Esquemas dos principais ficheiros de dados do Nexus System.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        {schemas.map(schema => (
          <div key={schema.name} className="layer-card space-y-3">
            <h3 className="text-sm font-semibold text-accent font-mono">{schema.name}</h3>
            <div className="flex flex-col gap-1">
              {schema.fields.map(field => (
                <div key={field.key} className="flex items-center gap-2 py-1">
                  <code className="text-xs text-text-primary font-mono">{field.key}</code>
                  <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-text-muted">{field.type}</span>
                  <span className="text-[10px] text-text-muted ml-auto hidden sm:inline">{field.description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/reference/types" className="block text-sm">→ Tipos</Link>
        <Link to="/reference/config" className="block text-sm">→ Configuracao</Link>
      </div>
    </div>
  )
}
