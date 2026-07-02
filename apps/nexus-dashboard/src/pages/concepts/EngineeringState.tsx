import { Link } from 'react-router-dom'

const laws = [
  'Estado acima da Memoria',
  'Conhecimento deve ser Operacional',
  'Evidencia prevalece sobre documentacao',
  'Evolucao preserva Engenharia',
  'Governanca e Adaptativa',
  'Todo Processo deve ser Verificavel',
  'Engenharia e um Sistema Vivo',
]

export default function EngineeringState() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Engineering State</h1>
        <p className="text-text-secondary max-w-2xl">
          Estado explicito e verificavel da engenharia. Nao depende de memoria humana.
        </p>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">O que e</h2>
        <p className="text-sm text-text-secondary">
          Engineering State e o principio fundamental do Nexus. Tudo que importa na engenharia — decisoes, contexto, conhecimento — deve ser preservado de forma explicita, versionavel e verificavel.
        </p>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Por que existe</h2>
        <p className="text-sm text-text-secondary">
          Software degrada quando depende de memoria humana. Pessoas esquecem, mudam de equipa, ou mudam de projecto. O estado da engenharia deve sobreviver a essas mudancas.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">7 Leis Fundamentais</h2>
        <div className="space-y-2">
          {laws.map((law, i) => (
            <div key={i} className="law-card">
              <span className="law-number">{i + 1}</span>
              <span className="text-sm text-text-secondary">{law}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Componentes</h2>
        <ul className="text-sm text-text-secondary space-y-1">
          <li><code className="text-accent">context_buffer.yaml</code> — RAM do sistema</li>
          <li><code className="text-accent">docs/history/</code> — ROM do sistema</li>
          <li><code className="text-accent">maturity-profile.json</code> — Perfil de maturidade</li>
          <li><code className="text-accent">engineering-state/</code> — Estado detalhado</li>
        </ul>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts/esm" className="block text-sm">→ ESM (Engineering State Method)</Link>
        <Link to="/concepts/capabilities" className="block text-sm">→ Capabilities</Link>
        <Link to="/concepts/governance" className="block text-sm">→ Governanca</Link>
      </div>
    </div>
  )
}
