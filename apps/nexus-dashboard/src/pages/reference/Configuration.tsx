import { Link } from 'react-router-dom'

const configs = [
  {
    name: 'opencode.json',
    description: 'Configuracao do opencode — agents, permissions, skills.',
    path: 'opencode.json',
  },
  {
    name: 'nexus-profile',
    description: 'Profile de configuracao especifico do projecto.',
    path: '.nexus/nexus-profile/',
  },
  {
    name: 'context_buffer.yaml',
    description: 'Estado actual da sessao de desenvolvimento.',
    path: 'governance/context/context_buffer.yaml',
  },
  {
    name: 'maturity-profile.json',
    description: 'Perfil de maturidade e thresholds.',
    path: '.nexus/maturity-profile.json',
  },
  {
    name: 'fingerprint.json',
    description: 'Identificador unico e stack do projecto.',
    path: '.nexus/fingerprint.json',
  },
]

export default function Configuration() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Configuracao</h1>
        <p className="text-text-secondary max-w-2xl">
          Ficheiros de configuracao do Nexus System e seus respectivos formatos.
        </p>
      </section>

      <section className="space-y-4">
        {configs.map(cfg => (
          <div key={cfg.name} className="layer-card space-y-2">
            <h3 className="text-sm font-semibold text-accent font-mono">{cfg.name}</h3>
            <p className="text-xs text-text-secondary">{cfg.description}</p>
            <code className="text-[10px] text-text-muted font-mono">{cfg.path}</code>
          </div>
        ))}
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/reference/schemas" className="block text-sm">→ Esquemas</Link>
        <Link to="/architecture/structure" className="block text-sm">→ Estrutura do Sistema</Link>
      </div>
    </div>
  )
}
