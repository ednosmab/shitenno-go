import { Link } from 'react-router-dom'

const layers = [
  { name: 'UI', description: 'Camada de apresentacao. React, componentes, hooks.', color: 'accent' },
  { name: 'Application', description: 'Casos de uso e orquestracao. Traduz requisitos em comandos.', color: 'purple' },
  { name: 'Domain', description: 'Nucleo do sistema. Regras de negocio puras.', color: 'neon' },
  { name: 'Infrastructure', description: 'Detalhes tecnicos. BD, APIs, servicos externos.', color: 'info' },
]

export default function ArchitectureConcept() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Arquitetura</h1>
        <p className="text-text-secondary max-w-2xl">
          Visao geral da arquitetura do Nexus System e seus componentes principais.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Camadas</h2>
        <div className="flex flex-col gap-2">
          {layers.map(layer => (
            <div key={layer.name} className="layer-card flex items-start gap-3">
              <span className={`w-3 h-3 rounded-sm mt-0.5 flex-shrink-0 bg-${layer.color}`} />
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{layer.name}</h3>
                <p className="text-xs text-text-secondary">{layer.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="layer-card flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Principio de dependencia</h2>
        <p className="text-sm text-text-secondary">
          Dependencias devem apontar sempre "para dentro" (em direcao ao Dominio puro). A UI importa UseCases, UseCases importam Interfaces, Infrastructure implementa Interfaces.
        </p>
      </section>

      <section className="layer-card flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">8 Conceitos Fundamentais</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['Entidades', 'Value Objects', 'Agregados', 'Repositorios', 'Domain Services', 'Domain Events', 'Use Cases', 'Interfaces'].map(c => (
            <span key={c} className="px-3 py-2 rounded-lg bg-surface-2 text-xs text-text-secondary text-center">{c}</span>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/architecture" className="block text-sm">→ Componentes</Link>
        <Link to="/architecture/flows" className="block text-sm">→ Fluxos</Link>
        <Link to="/architecture/domain" className="block text-sm">→ Modelo de Dominio</Link>
      </div>
    </div>
  )
}
