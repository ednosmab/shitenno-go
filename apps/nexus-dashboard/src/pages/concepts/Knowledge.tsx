import { Link } from 'react-router-dom'

const stages = [
  { name: 'Capture', description: 'Recolha de informacao bruta do sistema.' },
  { name: 'Validation', description: 'Verificacao da veracidade e relevancia.' },
  { name: 'Classification', description: 'Organizacao por tipo e dominio.' },
  { name: 'Storage', description: 'Persistencia em formato estruturado.' },
  { name: 'Retrieval', description: 'Acesso rapido e contextualizado.' },
  { name: 'Application', description: 'Uso do conhecimento em decisoes.' },
  { name: 'Evolution', description: 'Actualizacao continua do conhecimento.' },
  { name: 'Archival', description: 'Preservacao de historico.' },
  { name: 'Dissemination', description: 'Distribuicao para quem precisa.' },
]

export default function Knowledge() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Conhecimento</h1>
        <p className="text-text-secondary max-w-2xl">
          Como o Nexus gerencia o ciclo de vida do conhecimento no projeto.
        </p>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Knowledge Graph</h2>
        <p className="text-sm text-text-secondary">
          O Nexus mantem um grafo de conhecimento que conecta conceitos, componentes e decisoes. Este grafo e consultado para sugestoes e validacoes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">9 Estagios do ciclo de vida</h2>
        <div className="space-y-2">
          {stages.map((stage, i) => (
            <div key={stage.name} className="layer-card flex items-start gap-3">
              <span className="law-number">{i + 1}</span>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{stage.name}</h3>
                <p className="text-xs text-text-secondary">{stage.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts" className="block text-sm">→ Engineering State</Link>
        <Link to="/concepts/esm" className="block text-sm">→ ESM</Link>
        <Link to="/concepts/evolution" className="block text-sm">→ Evolucao</Link>
      </div>
    </div>
  )
}
