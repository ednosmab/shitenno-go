import { Link } from 'react-router-dom'

const laws = [
  { num: 1, title: 'Estado acima da Memoria', desc: 'Tudo que importa deve ser preservado em estado explicito, nao em memoria humana.' },
  { num: 2, title: 'Conhecimento deve ser Operacional', desc: 'Conhecimento que nao e accionavel nao e conhecimento — e ruído.' },
  { num: 3, title: 'Evidencia prevalece sobre documentacao', desc: 'O que o sistema mostra e mais confiavel do que o que a documentacao diz.' },
  { num: 4, title: 'Evolucao preserva Engenharia', desc: 'Mudancas devem preservar e melhorar o estado da engenharia, nunca degradá-lo.' },
  { num: 5, title: 'Governanca e Adaptativa', desc: 'Regras devem evoluir com o contexto, nao serem estaticas.' },
  { num: 6, title: 'Todo Processo deve ser Verificavel', desc: 'Se nao pode ser medido, nao pode ser melhorado.' },
  { num: 7, title: 'Engenharia e um Sistema Vivo', desc: 'Engenharia nao e um artefacto estatico — e um sistema que respira e evolui.' },
]

const principles = [
  { title: 'Minimalidade', desc: 'Fazer o minimo necessario para atingir o objectivo.' },
  { title: 'Composabilidade', desc: 'Componentes devem ser combinaveis e reutilizaveis.' },
  { title: 'Observabilidade', desc: 'O estado do sistema deve ser sempre visivel e auditavel.' },
  { title: 'Resiliencia', desc: 'O sistema deve tolerar falhas e recuperar-se automaticamente.' },
  { title: 'Evolutividade', desc: 'O sistema deve ser facil de modificar sem quebrar funcionalidades existentes.' },
  { title: 'Seguranca', desc: 'O sistema deve proteger dados sensiveis e prevenir acessos nao autorizados.' },
]

export default function ESM() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Engineering State Method (ESM)</h1>
        <p className="text-text-secondary max-w-2xl">
          Metodologia que define as 7 Leis Fundamentais e 6 Principios do Nexus.
        </p>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Ciclo de vida</h2>
        <div className="flex flex-wrap gap-2">
          {['Detectar', 'Analisar', 'Decidir', 'Implementar', 'Validar', 'Monitorar', 'Evolver'].map(stage => (
            <span key={stage} className="px-3 py-1.5 rounded-full bg-surface-2 text-xs text-text-secondary">{stage}</span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">7 Leis Fundamentais</h2>
        <div className="space-y-2">
          {laws.map(law => (
            <div key={law.num} className="law-card">
              <span className="law-number">{law.num}</span>
              <div>
                <div className="text-sm font-medium text-text-primary">{law.title}</div>
                <div className="text-xs text-text-muted mt-0.5">{law.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">6 Principios</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {principles.map(p => (
            <div key={p.title} className="layer-card space-y-1">
              <h3 className="text-sm font-semibold text-accent">{p.title}</h3>
              <p className="text-xs text-text-secondary">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts" className="block text-sm">→ Engineering State</Link>
        <Link to="/concepts/capabilities" className="block text-sm">→ Capabilities</Link>
        <Link to="/concepts/evolution" className="block text-sm">→ Evolucao</Link>
      </div>
    </div>
  )
}
