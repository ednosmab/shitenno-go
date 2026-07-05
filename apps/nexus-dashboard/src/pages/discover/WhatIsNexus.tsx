import { Link } from 'react-router-dom'
import { Logo } from '../../components/shared/Logo'

export default function WhatIsNexus() {
  return (
    <div className="flex flex-col gap-8">
      <section className="layer-hero text-center flex flex-col gap-4">
        <Logo size="lg" className="mx-auto" />
        <h1 className="text-2xl font-bold text-text-primary">What is Nexus?</h1>
        <p className="text-text-secondary max-w-2xl mx-auto">
          Nexus is a CLI that gives persistent context about your project to you and AI agents, so no one starts each session from zero.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">See it in action</h2>

        <div className="layer-card flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <code className="text-accent font-mono text-sm font-bold">nexus init</code>
            <span className="text-xs text-text-muted">— detect your stack and set up governance</span>
          </div>
          <pre className="text-xs text-text-secondary bg-surface-2 rounded-lg p-3 overflow-x-auto">{`  ╔══════════════════════════════════════════╗
  ║  nexus init — Maturity-Based Discovery   ║
  ╚══════════════════════════════════════════╝

- Analysing project...
✔ Project analysis complete

  Detected:
    Stack:     typescript
    Packages:  3
    Apps:      2
    Source:    255 files
    Manager:   pnpm
    TypeScript: yes
    Tests:     yes
    CI/CD:     yes`}</pre>
        </div>

        <div className="layer-card flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <code className="text-accent font-mono text-sm font-bold">nexus status</code>
            <span className="text-xs text-text-muted">— check governance health and maturity</span>
          </div>
          <pre className="text-xs text-text-secondary bg-surface-2 rounded-lg p-3 overflow-x-auto">{`  Governance Health:
    ✔ opencode.json: Configured with 4 agents
    ✔ AGENTS.md: 45 rules configured
    ✔ skills/: 22 skills installed
  Summary: ✔ 7 passed  ⚠ 0 warnings  ✘ 0 failed

  🎯 Maturity: 59/100 ████████████░░░░░░░░
  📊 Complexity: 12/20`}</pre>
        </div>
      </section>

      <section className="layer-card flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">What you get</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-accent text-sm font-bold">Governed context</div>
            <p className="text-xs text-text-secondary">
              AI agents receive the right knowledge, at the right time, in the right format.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-neon text-sm font-bold">Measured complexity</div>
            <p className="text-xs text-text-secondary">
              Static + behavioral scoring tells you exactly where your project stands.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-purple text-sm font-bold">Debt detection</div>
            <p className="text-xs text-text-secondary">
              Stale decisions, disconnected knowledge, repeated errors — caught before they compound.
            </p>
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Link to="/discover/who" className="btn btn-primary">
          Who is this for?
        </Link>
        <Link to="/discover/start" className="btn btn-secondary">
          Get started
        </Link>
      </div>
    </div>
  )
}
