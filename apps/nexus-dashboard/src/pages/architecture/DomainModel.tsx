import { Link } from 'react-router-dom'

const concepts = [
  { name: 'Entidades', description: 'Objetos com identidade unica que persiste no tempo. Devem conter logica de auto-validacao.' },
  { name: 'Value Objects', description: 'Objetos definidos apenas por seus atributos, imutaveis. Sempre usar VOs para evitar Primitive Obsession.' },
  { name: 'Agregados', description: 'Clusters de entidades e VOs tratados como unica unidade para mudancas. Aggregate Root e o unico ponto de entrada.' },
  { name: 'Repositorios', description: 'Interfaces no dominio para persistencia. Implementacao real fica na camada de infraestrutura.' },
  { name: 'Domain Services', description: 'Operacoes de dominio que nao pertencem a uma unica entidade ou VO.' },
  { name: 'Domain Events', description: 'Eventos disparados de dentro do agregado quando ocorre mudanca de estado relevante.' },
  { name: 'Use Cases', description: 'Orquestracao do fluxo de dados. Traduz requisitos externos em comandos para o dominio.' },
  { name: 'Interfaces', description: 'Contratos que definem o que e necessario, sem definir como e implementado.' },
]

export default function DomainModel() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Modelo de Dominio</h1>
        <p className="text-text-secondary max-w-2xl">
          Os 8 conceitos fundamentais do dominio do Nexus System.
        </p>
      </section>

      <section className="layer-card flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Principio de dependencia</h2>
        <p className="text-sm text-text-secondary">
          A camada de Dominio (nucleo do core) NUNCA deve importar nada de Infraestrutura ou UI. Use Injecao de Dependencia para fornecer implementacoes em tempo de execucao.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {concepts.map(c => (
            <div key={c.name} className="layer-card">
              <h3 className="text-sm font-semibold text-accent">{c.name}</h3>
              <p className="text-xs text-text-secondary mt-1">{c.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts/architecture" className="block text-sm">→ Arquitetura (Conceitos)</Link>
        <Link to="/engineering/contracts" className="block text-sm">→ Contratos (Engenharia)</Link>
      </div>
    </div>
  )
}
