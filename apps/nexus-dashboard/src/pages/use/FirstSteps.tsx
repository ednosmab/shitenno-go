import { Link } from 'react-router-dom'

export default function FirstSteps() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Primeiros passos</h1>
        <p className="text-text-secondary max-w-2xl">
          Apos instalar o Nexus, siga estes passos para comecar a utilizar.
        </p>
      </section>

      <section className="space-y-4">
        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">1</span>
            <h3 className="text-sm font-semibold text-text-primary">Navegue ate o projeto</h3>
          </div>
          <div className="command-block">cd meu-projeto</div>
        </div>

        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">2</span>
            <h3 className="text-sm font-semibold text-text-primary">Execute a inicializacao</h3>
          </div>
          <div className="command-block">nexus init</div>
          <p className="text-xs text-text-muted">O Nexus detecta automaticamente o stack do projeto.</p>
        </div>

        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">3</span>
            <h3 className="text-sm font-semibold text-text-primary">Consulte o status</h3>
          </div>
          <div className="command-block">nexus status</div>
          <p className="text-xs text-text-muted">Veja as capabilities ativas e a saude da governanca.</p>
        </div>

        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">4</span>
            <h3 className="text-sm font-semibold text-text-primary">Valide a conformidade</h3>
          </div>
          <div className="command-block">nexus validate</div>
          <p className="text-xs text-text-muted">Verifica se o projeto esta conforme as regras.</p>
        </div>
      </section>

      <div className="flex gap-3">
        <Link to="/use/commands" className="px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
          Ver comandos
        </Link>
        <Link to="/use/best-practices" className="px-4 py-2 rounded-lg border border-border-default text-text-secondary text-sm hover:bg-surface-2 transition-colors">
          Boas praticas
        </Link>
      </div>
    </div>
  )
}
