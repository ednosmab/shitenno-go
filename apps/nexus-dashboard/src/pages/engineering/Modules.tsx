import { Link } from 'react-router-dom'

const modules = [
  { name: 'CLI', description: 'Interface de linha de comandos. Parsing, output, interacao.' },
  { name: 'Profile', description: 'Deteccao de stack e geracao de nexus-profile.' },
  { name: 'State', description: 'Gestao de context_buffer e engineering-state.' },
  { name: 'Telemetry', description: 'Gravacao de snapshots e metricas periodicas.' },
  { name: 'Governance', description: 'Aplicacao de regras e validacao de conformidade.' },
  { name: 'Agents', description: 'Contratos e comportamento dos agentes IA.' },
  { name: 'Knowledge', description: 'Gestao do grafo de conhecimento.' },
  { name: 'Evolution', description: 'Tracking de maturidade e evolucao do sistema.' },
]

export default function Modules() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Modulos</h1>
        <p className="text-text-secondary max-w-2xl">
          Organizacao modular do Nexus System. Cada modulo tem uma responsabilidade unica.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {modules.map(mod => (
            <div key={mod.name} className="layer-card">
              <h3 className="text-sm font-semibold text-accent">{mod.name}</h3>
              <p className="text-xs text-text-secondary mt-1">{mod.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/engineering" className="block text-sm">→ Codigo Fonte</Link>
        <Link to="/engineering/contracts" className="block text-sm">→ Contratos</Link>
      </div>
    </div>
  )
}
