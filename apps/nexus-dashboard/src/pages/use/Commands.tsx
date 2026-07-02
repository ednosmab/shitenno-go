import { Link } from 'react-router-dom'

const commands = [
  {
    name: 'nexus init',
    purpose: 'Inicializa o framework no projeto actual',
    when: 'Sempre que iniciar um novo projecto ou adicionar o Nexus a um existente',
    example: 'nexus init',
    details: 'Detecta stack, gera profile, cria estrutura de governanca.',
  },
  {
    name: 'nexus status',
    purpose: 'Verifica a saude da governanca',
    when: 'Durante o desenvolvimento para monitorar estado',
    example: 'nexus status',
    details: 'Mostra capabilities, maturidade, health score.',
  },
  {
    name: 'nexus upgrade',
    purpose: 'Adiciona capacidades ao projecto',
    when: 'Quando precisa de novas funcionalidades ou capacidades',
    example: 'nexus upgrade --capability <name>',
    details: 'Adiciona capabilities especificas ou aceita as recomendadas.',
  },
  {
    name: 'nexus validate',
    purpose: 'Valida a conformidade do projecto',
    when: 'Antes de commits importantes ou antes de deploy',
    example: 'nexus validate',
    details: 'Verifica regras, tipos, estrutura e conformidade.',
  },
]

export default function Commands() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Comandos essenciais</h1>
        <p className="text-text-secondary max-w-2xl">
          Estes sao os 4 comandos fundamentais do Nexus. Cada um serve a um proposito especifico.
        </p>
      </section>

      <section className="space-y-4">
        {commands.map(cmd => (
          <div key={cmd.name} className="layer-card space-y-3">
            <div className="flex items-center gap-2">
              <code className="text-accent font-mono text-sm font-bold">{cmd.name}</code>
            </div>
            <p className="text-sm text-text-secondary">{cmd.purpose}</p>
            <div className="space-y-1">
              <div className="text-xs text-text-muted">Quando usar:</div>
              <p className="text-xs text-text-secondary">{cmd.when}</p>
            </div>
            <div className="command-block">{cmd.example}</div>
            <p className="text-xs text-text-muted">{cmd.details}</p>
          </div>
        ))}
      </section>

      <Link to="/use/best-practices" className="inline-flex px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
        Proximo: Boas praticas
      </Link>
    </div>
  )
}
