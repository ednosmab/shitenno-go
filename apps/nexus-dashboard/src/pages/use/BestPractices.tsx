import { Link } from 'react-router-dom'

const practices = [
  {
    title: 'Execute nexus init uma vez',
    description: 'Inicialize o Nexus apenas uma vez por projeto. O framework detecta mudancas automaticamente.',
  },
  {
    title: 'Verifique status regularmente',
    description: 'Execute nexus status durante o desenvolvimento para manter visibilidade sobre a saude da governanca.',
  },
  {
    title: 'Valide antes de commits',
    description: 'Execute nexus validate antes de commits importantes para garantir conformidade.',
  },
  {
    title: 'Adicione capabilities sob demanda',
    description: 'Nao adicione todas as capabilities de uma vez. Adicione conforme a necessidade do projeto.',
  },
  {
    title: 'Mantenha o context_buffer atualizado',
    description: 'O context_buffer e a memoria do sistema. Mantenha-o sempre atualizado com decisoes e estado actual.',
  },
  {
    title: 'Documente decisoes com ADRs',
    description: 'Use Architecture Decision Records para preservar o contexto de decisoes tecnicas importantes.',
  },
]

export default function BestPractices() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Boas praticas</h1>
        <p className="text-text-secondary max-w-2xl">
          Siga estas praticas para tirar o maximo proveito do Nexus.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        {practices.map(practice => (
          <div key={practice.title} className="layer-card space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">{practice.title}</h3>
            <p className="text-sm text-text-secondary">{practice.description}</p>
          </div>
        ))}
      </section>

      <div className="flex gap-3">
        <Link to="/concepts" className="btn btn-primary">
          Entender conceitos
        </Link>
        <Link to="/architecture" className="btn btn-secondary">
          Ver arquitetura
        </Link>
      </div>
    </div>
  )
}
