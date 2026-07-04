import { Link } from 'react-router-dom'

export default function GettingStarted() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Get started in 3 commands</h1>
        <p className="text-text-secondary max-w-2xl">
          Install, initialize, and check your project's health. Takes about 2 minutes.
        </p>
      </section>

      <section className="space-y-4">
        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">1</span>
            <h3 className="text-sm font-semibold text-text-primary">Install the CLI</h3>
          </div>
          <div className="command-block">npm install -g nexus-system</div>
        </div>

        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">2</span>
            <h3 className="text-sm font-semibold text-text-primary">Initialize your project</h3>
          </div>
          <div className="command-block">nexus init</div>
          <pre className="text-xs text-text-secondary bg-surface-2 rounded-lg p-3 overflow-x-auto">{`  Detected:
    Stack:     typescript
    Packages:  3
    Apps:      2
    Source:    255 files
    Manager:   pnpm`}</pre>
          <p className="text-xs text-text-muted">Detects your stack and creates governance structure automatically.</p>
        </div>

        <div className="layer-card space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-accent-subtle text-accent flex items-center justify-center text-xs font-bold">3</span>
            <h3 className="text-sm font-semibold text-text-primary">Check your status</h3>
          </div>
          <div className="command-block">nexus status</div>
          <pre className="text-xs text-text-secondary bg-surface-2 rounded-lg p-3 overflow-x-auto">{`  Governance Health: ✔ 7 passed  ⚠ 0 warnings  ✘ 0 failed
  Maturity: 59/100 ████████████░░░░░░░░
  Complexity: 12/20`}</pre>
          <p className="text-xs text-text-muted">Shows governance health, maturity score, and complexity analysis.</p>
        </div>
      </section>

      <div className="flex gap-3">
        <Link to="/use/first-steps" className="px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
          What next?
        </Link>
        <Link to="/discover/why" className="px-4 py-2 rounded-lg border border-border-default text-text-secondary text-sm hover:bg-surface-2 transition-colors">
          Why does this exist?
        </Link>
      </div>
    </div>
  )
}
