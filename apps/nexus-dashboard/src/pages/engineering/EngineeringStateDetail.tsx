import { Link } from 'react-router-dom'

const areas = [
  { name: 'Codigo', status: 'operational', details: 'TypeScript zero erros, build funcional.' },
  { name: 'Testes', status: 'operational', details: 'Suite completa a passar.' },
  { name: 'Documentacao', status: 'operational', details: 'Guias actualizados e correctos.' },
  { name: 'Governanca', status: 'operational', details: 'Regras aplicadas e verificadas.' },
  { name: 'Deploy', status: 'operational', details: 'Pipeline funcional e rapido.' },
  { name: 'Seguranca', status: 'operational', details: 'Validacao de inputs e XSS prevenido.' },
]

export default function EngineeringStateDetail() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Estado Detalhado</h1>
        <p className="text-text-secondary max-w-2xl">
          Estado actual da engenharia por area funcional.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {areas.map(area => (
            <div key={area.name} className="layer-card flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${area.status === 'operational' ? 'bg-success' : area.status === 'degraded' ? 'bg-warning' : 'bg-danger'}`} />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-text-primary">{area.name}</h3>
                <p className="text-xs text-text-secondary">{area.details}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neon-subtle text-neon">{area.status}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts" className="block text-sm">→ Engineering State</Link>
        <Link to="/concepts/governance" className="block text-sm">→ Governanca</Link>
      </div>
    </div>
  )
}
