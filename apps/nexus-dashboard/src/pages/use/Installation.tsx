import { Link } from 'react-router-dom'

export default function Installation() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Instalacao</h1>
        <p className="text-text-secondary max-w-2xl">
          Instale o Nexus System no seu ambiente de desenvolvimento.
        </p>
      </section>

      <section className="space-y-4">
        <div className="layer-card space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Requisitos</h3>
          <ul className="text-sm text-text-secondary space-y-1">
            <li>Node.js 18+ ou superior</li>
            <li>pnpm (recomendado) ou npm</li>
            <li>Terminal / CLI</li>
          </ul>
        </div>

        <div className="layer-card space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Instalacao global</h3>
          <div className="command-block">pnpm add -g nexus-system</div>
          <p className="text-xs text-text-muted">Instala o CLI do Nexus globalmente no seu sistema.</p>
        </div>

        <div className="layer-card space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Verificar instalacao</h3>
          <div className="command-block">nexus --version</div>
          <p className="text-xs text-text-muted">Deve retornar a versao instalada do Nexus.</p>
        </div>

        <div className="layer-card space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Inicializar num projeto</h3>
          <div className="command-block">nexus init</div>
          <p className="text-xs text-text-muted">Detecta o stack, gera o profile, e cria a estrutura de governanca.</p>
        </div>
      </section>

      <Link to="/use/first-steps" className="inline-flex px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
        Proximo: Primeiros passos
      </Link>
    </div>
  )
}
