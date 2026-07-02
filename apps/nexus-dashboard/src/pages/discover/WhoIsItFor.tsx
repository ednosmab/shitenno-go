import { Link } from 'react-router-dom'

const profiles = [
  {
    title: 'Developer',
    description: 'Que trabalha com IA e precisa de governanca para manter qualidade.',
    icon: '◈',
  },
  {
    title: 'Tech Lead',
    description: 'Que precisa de visibilidade sobre estado da engenharia e decisoes tomadas.',
    icon: '◆',
  },
  {
    title: 'Arquitecto',
    description: 'Que quer preservar decisoes de design e garantir consistencia.',
    icon: '⬡',
  },
  {
    title: 'Mantenedor',
    description: 'Que precisa de estado explicito para manter sistemas saudaveis.',
    icon: '▣',
  },
]

export default function WhoIsItFor() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Para quem e o Nexus?</h1>
        <p className="text-text-secondary max-w-2xl">
          O Nexus foi desenhado para qualquer pessoa que desenvolve software e quer manter qualidade e consistencia.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        {profiles.map(profile => (
          <div key={profile.title} className="layer-card space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-accent text-lg">{profile.icon}</span>
              <h3 className="text-sm font-semibold text-text-primary">{profile.title}</h3>
            </div>
            <p className="text-sm text-text-secondary">{profile.description}</p>
          </div>
        ))}
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Caso de uso comum</h2>
        <p className="text-sm text-text-secondary">
          Um developer inicia um projeto com IA. Na primeira sessao, o Nexus detecta o stack, gera o profile, e orienta as proximas acoes. Nas sessoes seguintes, mantem o estado da engenharia atualizado e alerta sobre degradacao.
        </p>
      </section>

      <Link to="/discover/start" className="inline-flex px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
        Comecar agora
      </Link>
    </div>
  )
}
