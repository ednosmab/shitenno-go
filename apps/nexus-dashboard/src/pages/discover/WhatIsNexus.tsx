import { Link } from 'react-router-dom'
import { Logo } from '../../components/shared/Logo'

export default function WhatIsNexus() {
  return (
    <div className="space-y-8">
      <section className="layer-hero text-center space-y-4">
        <Logo size="lg" className="mx-auto" />
        <h1 className="text-2xl font-bold text-text-primary">O que e o Nexus?</h1>
        <p className="text-text-secondary max-w-2xl mx-auto">
          Nexus e um framework de governanca para desenvolvimento de software assistido por IA.
        </p>
      </section>

      <section className="grid sm:grid-cols-3 gap-4">
        <div className="layer-card space-y-2">
          <div className="text-accent text-lg font-bold">Problema</div>
          <p className="text-sm text-text-secondary">
            Software degrada quando decisoes, contexto e conhecimento deixam de ser preservados. Equipes perdem alinhamento, erros se repetem e qualidade cai.
          </p>
        </div>
        <div className="layer-card space-y-2">
          <div className="text-neon text-lg font-bold">Solucao</div>
          <p className="text-sm text-text-secondary">
            Transformar conhecimento tacito em estado explicito, verificavel e operacional. O Nexus torna o invisivel visivel.
          </p>
        </div>
        <div className="layer-card space-y-2">
          <div className="text-purple text-lg font-bold">Resultado</div>
          <p className="text-sm text-text-secondary">
            Governanca automatizada, scoring de complexidade, deteccao de padroes e gestao de capabilities.
          </p>
        </div>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Principio Fundamental</h2>
        <blockquote className="border-l-2 border-accent pl-4 text-text-secondary italic">
          "A engenharia nao deve depender da memoria. Deve depender de estado explicito."
        </blockquote>
      </section>

      <div className="flex gap-3">
        <Link to="/discover/why" className="px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
          Por que existe?
        </Link>
        <Link to="/use" className="px-4 py-2 rounded-lg border border-border-default text-text-secondary text-sm hover:bg-surface-2 transition-colors">
          Comecar a usar
        </Link>
      </div>
    </div>
  )
}
