import { Link } from 'react-router-dom'

export default function GettingStarted() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Comecar com o Nexus</h1>
        <p className="text-text-secondary max-w-2xl">
          Siga estes passos para instalar e configurar o Nexus no seu projeto.
        </p>
      </section>

      <section className="space-y-4">
        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">1</span>
            <h3 className="text-sm font-semibold text-text-primary">Instale o Nexus</h3>
          </div>
          <div className="command-block">pnpm add -g nexus-system</div>
        </div>

        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">2</span>
            <h3 className="text-sm font-semibold text-text-primary">Inicialize no projeto</h3>
          </div>
          <div className="command-block">nexus init</div>
          <p className="text-xs text-text-muted">Detecta o stack automaticamente e gera o profile.</p>
        </div>

        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">3</span>
            <h3 className="text-sm font-semibold text-text-primary">Verifique o status</h3>
          </div>
          <div className="command-block">nexus status</div>
          <p className="text-xs text-text-muted">Mostra saude da governanca e capabilities ativas.</p>
        </div>

        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">4</span>
            <h3 className="text-sm font-semibold text-text-primary">Valide a conformidade</h3>
          </div>
          <div className="command-block">nexus validate</div>
          <p className="text-xs text-text-muted">Verifica regras, tipos e estrutura do projeto.</p>
        </div>
      </section>

      <div className="flex gap-3">
        <Link to="/use/commands" className="px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
          Ver todos os comandos
        </Link>
        <Link to="/concepts" className="px-4 py-2 rounded-lg border border-border-default text-text-secondary text-sm hover:bg-surface-2 transition-colors">
          Entender os conceitos
        </Link>
      </div>
    </div>
  )
}
