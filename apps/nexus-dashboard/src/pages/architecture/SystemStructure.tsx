import { Link } from 'react-router-dom'

const structure = [
  { path: '.nexus/', description: 'Directorio principal do framework.', type: 'dir' },
  { path: '.nexus/nexus-profile/', description: 'Profile de configuracao do projecto.', type: 'dir' },
  { path: '.nexus/engineering-state/', description: 'Estado detalhado da engenharia.', type: 'dir' },
  { path: 'docs/', description: 'Documentacao do projecto.', type: 'dir' },
  { path: 'docs/AGENTS.md', description: 'Regras do time de engenharia IA.', type: 'file' },
  { path: 'docs/FORBIDDEN_OPERATIONS.md', description: 'Operacoes proibidas.', type: 'file' },
  { path: 'docs/DESDO.md', description: 'Diretrizes de engenharia.', type: 'file' },
  { path: 'governance/', description: 'Directorio de governanca.', type: 'dir' },
  { path: 'governance/agents/', description: 'Contratos dos agentes IA.', type: 'dir' },
  { path: 'governance/context/', description: 'Estado da sessao actual.', type: 'dir' },
  { path: 'governance/knowledge-graph/', description: 'Grafo de conceitos.', type: 'dir' },
  { path: 'telemetry/', description: 'Snapshots periodicos.', type: 'dir' },
  { path: 'reports/', description: 'Relatorios gerados.', type: 'dir' },
  { path: 'feedback/', description: 'Registos de feedback.', type: 'dir' },
]

export default function SystemStructure() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Estrutura do Sistema</h1>
        <p className="text-text-secondary max-w-2xl">
          Arvore de directorios e ficheiros do Nexus System.
        </p>
      </section>

      <section className="layer-card flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          {structure.map(item => (
            <div key={item.path} className="flex items-center gap-2 py-1">
              <span className={`text-xs ${item.type === 'dir' ? 'text-accent' : 'text-text-muted'}`}>
                {item.type === 'dir' ? '📁' : '📄'}
              </span>
              <code className="text-xs text-text-primary font-mono">{item.path}</code>
              <span className="text-[10px] text-text-muted ml-auto hidden sm:inline">{item.description}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/architecture" className="block text-sm">→ Componentes</Link>
        <Link to="/architecture/dependencies" className="block text-sm">→ Dependencias</Link>
      </div>
    </div>
  )
}
