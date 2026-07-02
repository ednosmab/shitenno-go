import { Link } from 'react-router-dom'

const policies = [
  { id: 'POL-01', title: 'Commits controlados', description: 'Commit apenas com autorizacao explicita.' },
  { id: 'POL-02', title: 'Mensagens em ingles', description: 'Mensagens de commit curtas e em ingles.' },
  { id: 'POL-03', title: 'Bootstrap proactivo', description: 'Instalar dependencias e criar estrutura automaticamente.' },
  { id: 'POL-04', title: 'Refactoring imediato', description: 'Identificar e corrigir codigo repetido ou mal nomeado.' },
  { id: 'POL-05', title: 'TDD estrito', description: 'Ciclo Red-Green-Refactor em toda funcionalidade.' },
  { id: 'POL-06', title: 'Validacao de seguranca', description: 'Verificar XSS e seguranca em inputs do utilizador.' },
  { id: 'POL-07', title: 'Postura senior', description: 'Ler antes de escrever, alteracao minima, verificar apos cada step.' },
  { id: 'POL-08', title: 'Teste de integridade', description: 'Diagnosticar apos commits para garantir que nada quebrou.' },
  { id: 'POL-09', title: 'Checklist de ambiente', description: 'Validar configs antes de deploy.' },
  { id: 'POL-10', title: 'Prioridade de entrada', description: 'Iniciar sempre pelo item P0 activo.' },
  { id: 'POL-11', title: 'Fim de sessao', description: 'Executar ritual de fechamento antes de encerrar.' },
  { id: 'POL-12', title: 'Quick Board', description: 'Apresentar estado actual na primeira resposta.' },
]

export default function Policies() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Politicas</h1>
        <p className="text-text-secondary max-w-2xl">
          12 regras vinculantes que governam o comportamento do sistema e dos agentes.
        </p>
      </section>

      <section className="space-y-3">
        <div className="space-y-2">
          {policies.map(pol => (
            <div key={pol.id} className="layer-card flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-accent-subtle text-accent text-xs font-mono font-bold flex-shrink-0">{pol.id}</span>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{pol.title}</h3>
                <p className="text-xs text-text-secondary">{pol.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="cross-links space-y-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/concepts/governance" className="block text-sm">→ Governanca</Link>
        <Link to="/concepts/esm" className="block text-sm">→ ESM</Link>
      </div>
    </div>
  )
}
