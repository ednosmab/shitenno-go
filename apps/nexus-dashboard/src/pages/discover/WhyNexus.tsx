import { Link } from 'react-router-dom'

export default function WhyNexus() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Why does Nexus exist?</h1>
        <p className="text-text-secondary max-w-2xl">
          Engineering teams accumulate knowledge but fail to govern it. ADRs are written but never referenced. Decisions are repeated because no one remembers the previous one.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-text-primary">The problem it solves</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="layer-card flex flex-col gap-2">
            <h3 className="text-sm font-medium text-danger">Without Nexus</h3>
            <ul className="text-sm text-text-secondary flex flex-col gap-1">
              <li>Decisions forgotten after session change</li>
              <li>Tacit knowledge lost between team members</li>
              <li>Repeated errors from lack of standardization</li>
              <li>Quality impossible to measure or track</li>
            </ul>
          </div>
          <div className="layer-card flex flex-col gap-2">
            <h3 className="text-sm font-medium text-neon">With Nexus</h3>
            <ul className="text-sm text-text-secondary flex flex-col gap-1">
              <li>Explicit state preserved in files</li>
              <li>Operational knowledge accessible to everyone</li>
              <li>Binding rules verified automatically</li>
              <li>Complexity measured and monitored</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="layer-card flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">How it works</h2>
        <p className="text-sm text-text-secondary">
          Nexus detects your project's context, generates a maturity profile, and provides tools to keep engineering healthy over time.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="px-2 py-1 rounded bg-surface-2 text-xs text-text-secondary">Detects stack</span>
          <span className="px-2 py-1 rounded bg-surface-2 text-xs text-text-secondary">Generates profile</span>
          <span className="px-2 py-1 rounded bg-surface-2 text-xs text-text-secondary">Monitors health</span>
          <span className="px-2 py-1 rounded bg-surface-2 text-xs text-text-secondary">Evolves adaptively</span>
        </div>
      </section>

      <Link to="/use/first-steps" className="btn btn-primary">
        Start using Nexus
      </Link>
    </div>
  )
}
