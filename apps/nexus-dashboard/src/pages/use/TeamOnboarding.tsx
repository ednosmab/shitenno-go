import { Link } from 'react-router-dom'

export default function TeamOnboarding() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Joining a team that uses Nexus?</h1>
        <p className="text-text-secondary max-w-2xl">
          You don't need to read everything. Here's what to do on your first day.
        </p>
      </section>

      <section className="space-y-4">
        <div className="layer-card space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">1</span>
            <h3 className="text-sm font-semibold text-text-primary">Get the project summary in one command</h3>
          </div>
          <div className="command-block">nexus status</div>
          <p className="text-xs text-text-muted">
            This replaces "can someone catch me up on the project?" — it shows governance health, maturity scores, and complexity in one view.
          </p>
        </div>

        <div className="layer-card space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">2</span>
            <h3 className="text-sm font-semibold text-text-primary">Find the team's decisions</h3>
          </div>
          <p className="text-sm text-text-secondary">
            Architectural decisions are recorded as ADRs (Architecture Decision Records). You can find them at:
          </p>
          <ul className="text-sm text-text-secondary space-y-1">
            <li><code className="text-accent">nexus-system/docs/adr/</code> — Decision records</li>
            <li><code className="text-accent">nexus-system/docs/skills/</code> — Engineering practices the team follows</li>
            <li><code className="text-accent">nexus-system/governance/context/context_buffer.yaml</code> — Current session state</li>
          </ul>
          <p className="text-xs text-text-muted">
            You don't need to read all of them. Start with <code className="text-accent">nexus status</code> — it tells you which areas need attention.
          </p>
        </div>

        <div className="layer-card space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">3</span>
            <h3 className="text-sm font-semibold text-text-primary">Navigate this dashboard</h3>
          </div>
          <p className="text-sm text-text-secondary">
            This dashboard shows real data from the project. Here's what each section covers:
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mt-2">
            <div className="bg-surface-2 rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold text-text-primary">Discover</div>
              <p className="text-xs text-text-muted">What Nexus is and who it's for</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold text-text-primary">Concepts</div>
              <p className="text-xs text-text-muted">Engineering State, Capabilities, Governance</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold text-text-primary">Architecture</div>
              <p className="text-xs text-text-muted">Components, dependencies, and data flows</p>
            </div>
            <div className="bg-surface-2 rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold text-text-primary">Engineering</div>
              <p className="text-xs text-text-muted">Source code analysis, modules, contracts, ADRs</p>
            </div>
          </div>
        </div>
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Quick reference</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <code className="text-accent font-mono text-xs font-bold">nexus status</code>
            <span className="text-xs text-text-secondary">— Project health and maturity</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-accent font-mono text-xs font-bold">nexus run</code>
            <span className="text-xs text-text-secondary">— Full pipeline (run weekly)</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-accent font-mono text-xs font-bold">nexus validate</code>
            <span className="text-xs text-text-secondary">— Check session integrity</span>
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Link to="/" className="px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
          Go to Dashboard
        </Link>
        <Link to="/use/commands" className="px-4 py-2 rounded-lg border border-border-default text-text-secondary text-sm hover:bg-surface-2 transition-colors">
          All commands
        </Link>
      </div>
    </div>
  )
}
