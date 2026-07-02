import { Link } from 'react-router-dom'

const entryPoints = [
  { path: 'nexus-system/.nexus/', description: 'Directorio principal do framework.' },
  { path: 'nexus-system/docs/', description: 'Documentacao e guias.' },
  { path: 'nexus-system/governance/', description: 'Regras e agentes de governanca.' },
  { path: 'nexus-system/telemetry/', description: 'Dados de telemetria.' },
  { path: 'nexus-system/reports/', description: 'Relatorios gerados.' },
  { path: 'nexus-system/feedback/', description: 'Registos de feedback.' },
]

export default function SourceCode() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Codigo Fonte</h1>
        <p className="text-text-secondary max-w-2xl">
          Estrutura de pastas e entry points do Nexus System.
        </p>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Entry Points</h2>
        <div className="space-y-1">
          {entryPoints.map(ep => (
            <div key={ep.path} className="flex items-center gap-2 py-1">
              <code className="text-accent text-xs font-mono">{ep.path}</code>
              <span className="text-[10px] text-text-muted ml-auto">{ep.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Convencoes</h2>
        <ul className="text-sm text-text-secondary space-y-1">
          <li>Ficheiros em ingles</li>
          <li>Nomenclatura kebab-case para ficheiros</li>
          <li>PascalCase para componentes</li>
          <li>camelCase para variaveis e funcoes</li>
          <li>UPPER_SNAKE_CASE para constantes</li>
        </ul>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/engineering/modules" className="block text-sm">→ Modulos</Link>
        <Link to="/architecture/structure" className="block text-sm">→ Estrutura do Sistema</Link>
      </div>
    </div>
  )
}
