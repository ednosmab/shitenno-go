import { Link } from 'react-router-dom'

const rules = [
  { id: 'TG-01', title: 'Zero erros de TypeScript', description: 'Compilacao deve ser limpa antes de qualquer commit.' },
  { id: 'TG-02', title: 'Testes verde', description: 'Toda a suite de testes deve passar.' },
  { id: 'TG-03', title: 'Build funcional', description: 'O build de producao deve completar sem erros.' },
  { id: 'TG-04', title: 'Lint limpo', description: 'Nenhum warning ou erro de linting.' },
  { id: 'TG-05', title: 'Context buffer actualizado', description: 'Estado da sessao deve reflectir o trabalho feito.' },
  { id: 'TG-06', title: 'Backlog actualizado', description: 'Itens devem ter estado correcto no BACKLOG.md.' },
]

export default function TechnicalGovernance() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Governanca Tecnica</h1>
        <p className="text-text-secondary max-w-2xl">
          Regras tecnicas que devem ser cumpridas antes de considerar uma tarefa completa.
        </p>
      </section>

      <section className="space-y-3">
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="layer-card flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-accent-subtle text-accent text-xs font-mono font-bold flex-shrink-0">{rule.id}</span>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{rule.title}</h3>
                <p className="text-xs text-text-secondary">{rule.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts/governance" className="block text-sm">→ Governanca</Link>
        <Link to="/concepts/policies" className="block text-sm">→ Politicas</Link>
      </div>
    </div>
  )
}
