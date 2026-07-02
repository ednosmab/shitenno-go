import { Link } from 'react-router-dom'

export default function WhyNexus() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Por que o Nexus existe?</h1>
        <p className="text-text-secondary max-w-2xl">
          O Nexus nasceu da necessidade real de manter engenharia saudavel em projetos onde IA e humenos trabalham juntos.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">O problema que resolve</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="layer-card space-y-2">
            <h3 className="text-sm font-medium text-danger">Sem Nexus</h3>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>Decisoes esquecidas apos mudanca de sessao</li>
              <li>Conhecimento tacito perdido entre membros</li>
              <li>Erros repetidos por falta de padronizacao</li>
              <li>Qualidade dificil de medir e acompanhar</li>
            </ul>
          </div>
          <div className="layer-card space-y-2">
            <h3 className="text-sm font-medium text-neon">Com Nexus</h3>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>Estado explicito preservado em arquivos</li>
              <li>Conhecimento operacional acessivel</li>
              <li>Regras vinculantes verificaveis automaticamente</li>
              <li>Complexidade medida e monitorada</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Como funciona</h2>
        <p className="text-sm text-text-secondary">
          O Nexus detecta o contexto do seu projeto, gera um profile de configuracao, e fornece ferramentas para manter a engenharia sadia ao longo do tempo.
        </p>
        <div className="flex gap-2 mt-2">
          <span className="px-2 py-1 rounded bg-surface-2 text-xs text-text-secondary">Detecta stack</span>
          <span className="px-2 py-1 rounded bg-surface-2 text-xs text-text-secondary">Gera profile</span>
          <span className="px-2 py-1 rounded bg-surface-2 text-xs text-text-secondary">Monitora saude</span>
          <span className="px-2 py-1 rounded bg-surface-2 text-xs text-text-secondary">Evolve adaptativamente</span>
        </div>
      </section>

      <Link to="/discover/who" className="inline-flex px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
        Para quem e?
      </Link>
    </div>
  )
}
