import { Link } from 'react-router-dom'

const commands = [
  {
    name: 'nexus init',
    description: 'Inicializa o framework no projecto actual.',
    params: [],
    example: 'nexus init',
    output: 'Detecta stack, gera profile, cria estrutura.',
  },
  {
    name: 'nexus status',
    description: 'Verifica a saude da governanca do projecto.',
    params: [],
    example: 'nexus status',
    output: 'Mostra capabilities, maturidade, health score.',
  },
  {
    name: 'nexus upgrade',
    description: 'Adiciona capacidades ao projecto.',
    params: ['--capability <name>', '--accept-recommended'],
    example: 'nexus upgrade --capability context-detection',
    output: 'Instala capability e actualiza context_buffer.',
  },
  {
    name: 'nexus validate',
    description: 'Valida a conformidade do projecto.',
    params: [],
    example: 'nexus validate',
    output: 'Verifica regras, tipos, estrutura e gera relatorio.',
  },
]

export default function API() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">API — Comandos CLI</h1>
        <p className="text-text-secondary max-w-2xl">
          Referencia completa dos comandos disponiveis no Nexus CLI.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        {commands.map(cmd => (
          <div key={cmd.name} className="layer-card space-y-3">
            <code className="text-accent font-mono text-sm font-bold">{cmd.name}</code>
            <p className="text-sm text-text-secondary">{cmd.description}</p>
            {cmd.params.length > 0 && (
              <div>
                <div className="text-xs text-text-muted mb-1">Parametros:</div>
                <div className="flex flex-wrap gap-1">
                  {cmd.params.map(p => (
                    <span key={p} className="px-2 py-0.5 rounded bg-surface-2 text-[10px] text-text-secondary font-mono">{p}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="command-block">{cmd.example}</div>
            <p className="text-xs text-text-muted">{cmd.output}</p>
          </div>
        ))}
      </section>

      <div className="cross-links flex flex-col gap-2">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Conceitos relacionados</div>
        <Link to="/use/commands" className="block text-sm">→ Comandos (Utilize)</Link>
        <Link to="/reference/contracts" className="block text-sm">→ Contratos</Link>
      </div>
    </div>
  )
}
