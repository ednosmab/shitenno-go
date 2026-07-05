import { Link } from 'react-router-dom'

const adrs = [
  { id: 'ADR-001', title: 'Uso de context_buffer como RAM', status: 'aceite', date: '2026-06-30' },
  { id: 'ADR-002', title: 'Estrutura de pastas .nexus/', status: 'aceite', date: '2026-06-30' },
  { id: 'ADR-003', title: 'Formato YAML para context_buffer', status: 'aceite', date: '2026-06-30' },
  { id: 'ADR-004', title: '4 comandos essenciais (init, status, upgrade, validate)', status: 'aceite', date: '2026-07-01' },
  { id: 'ADR-005', title: 'Contratos de agentes IA', status: 'aceite', date: '2026-07-01' },
  { id: 'ADR-006', title: 'Dashboard como Knowledge Interface', status: 'aceite', date: '2026-07-02' },
]

export default function ADRs() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Architecture Decision Records</h1>
        <p className="text-text-secondary max-w-2xl">
          Decisoes de arquitetura documentadas e aceites no projeto.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {adrs.map(adr => (
            <div key={adr.id} className="layer-card flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-accent-subtle text-accent text-xs font-mono font-bold flex-shrink-0">{adr.id}</span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-text-primary">{adr.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded bg-neon-subtle text-neon text-[10px]">{adr.status}</span>
                  <span className="text-[10px] text-text-muted">{adr.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts/governance" className="block text-sm">→ Governanca</Link>
        <Link to="/concepts/architecture" className="block text-sm">→ Arquitetura</Link>
      </div>
    </div>
  )
}
