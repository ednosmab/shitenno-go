import { Link } from 'react-router-dom'

const flows = [
  {
    name: 'nexus init',
    steps: ['Detectar stack do projeto', 'Gerar nexus-profile', 'Criar estrutura de governanca', 'Inicializar context_buffer', 'Gravar snapshot inicial'],
  },
  {
    name: 'nexus status',
    steps: ['Ler context_buffer', 'Ler maturity-profile', 'Calcular health score', 'Listar capabilities activas', 'Formatar output'],
  },
  {
    name: 'nexus upgrade',
    steps: ['Validar capabilities disponiveis', 'Verificar compatibilidade', 'Instalar capability seleccionada', 'Actualizar context_buffer', 'Gravar snapshot'],
  },
  {
    name: 'nexus validate',
    steps: ['Ler regras de governanca', 'Verificar conformidade de tipos', 'Validar estrutura de pastas', 'Verificar FORBIDDEN_OPERATIONS', 'Gerar relatorio'],
  },
]

export default function Flows() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Fluxos</h1>
        <p className="text-text-secondary max-w-2xl">
          Fluxos principais do Nexus System e a sequencia de operacoes de cada um.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        {flows.map(flow => (
          <div key={flow.name} className="layer-card space-y-3">
            <h3 className="text-sm font-semibold text-accent font-mono">{flow.name}</h3>
            <div className="flex flex-col gap-1">
              {flow.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="w-5 h-5 rounded-full bg-surface-2 flex items-center justify-center text-[10px] text-text-muted flex-shrink-0">{i + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/architecture" className="block text-sm">→ Componentes</Link>
        <Link to="/architecture/responsibilities" className="block text-sm">→ Responsabilidades</Link>
      </div>
    </div>
  )
}
