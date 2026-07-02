import { Link } from 'react-router-dom'

const rules = [
  { id: 'G-01', title: 'Commits requerem aprovacao', description: 'Nao e permitido commitar sem autorizacao explicita do utilizador.' },
  { id: 'G-02', title: 'Commits em ingles', description: 'Mensagens de commit devem ser concisas e em ingles.' },
  { id: 'G-03', title: 'TDD estrito', description: 'Testes primeiro, codigo depois. Ciclo Red-Green-Refactor.' },
  { id: 'G-04', title: 'Validacao de seguranca', description: 'Verificar XSS e seguranca antes de implementar.' },
  { id: 'G-05', title: 'Postura senior', description: 'Ler antes de escrever, alteracao minima, verificar apos cada step.' },
]

export default function Governance() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Governanca</h1>
        <p className="text-text-secondary max-w-2xl">
          Regras vinculantes que garantem qualidade e consistencia no desenvolvimento.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Regras vinculantes</h2>
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

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">FORBIDDEN_OPERATIONS</h2>
        <p className="text-sm text-text-secondary">
          Operacoes absolutamente proibidas. Qualquer violacao deve ser reportada e corrigida imediatamente.
        </p>
        <ul className="text-xs text-text-secondary space-y-1 mt-2">
          <li>Commit sem permissao</li>
          <li>Codigo sem testes</li>
          <li>Segredos versionados</li>
          <li>Modificacoes fora do escopo</li>
        </ul>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts" className="block text-sm">→ Engineering State</Link>
        <Link to="/concepts/esm" className="block text-sm">→ ESM</Link>
        <Link to="/concepts/policies" className="block text-sm">→ Politicas</Link>
      </div>
    </div>
  )
}
