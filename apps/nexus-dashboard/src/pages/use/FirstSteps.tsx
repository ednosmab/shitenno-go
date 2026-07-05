import { Link } from 'react-router-dom'

export default function FirstSteps() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-text-primary">What happens after nexus init</h1>
        <p className="text-text-secondary max-w-2xl">
          You've initialized Nexus. Here's what it created and how to use it.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <div className="layer-card flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">What was created</h3>
          <ul className="text-sm text-text-secondary flex flex-col gap-1">
            <li><code className="text-accent">opencode.json</code> — Agent configuration (4 agents: planner, build, review, orchestrator)</li>
            <li><code className="text-accent">nexus-system/</code> — Governance framework (skills, scripts, contracts)</li>
            <li><code className="text-accent">nexus-system/docs/skills/</code> — 22 engineering skills</li>
            <li><code className="text-accent">nexus-system/governance/</code> — Agent contracts and context</li>
          </ul>
        </div>

        <div className="layer-card flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Check the full picture</h3>
          <div className="command-block">nexus status</div>
          <pre className="text-xs text-text-secondary bg-surface-2 rounded-lg p-3 overflow-x-auto">{`  Governance Health:
    ✔ opencode.json: Configured with 4 agents
    ✔ AGENTS.md: 45 rules configured
    ✔ skills/: 22 skills installed
    ✔ context_buffer.yaml: Valid
    ✔ agent contracts: 4 contracts defined
  Summary: ✔ 7 passed  ⚠ 0 warnings  ✘ 0 failed

  🎯 Maturity Profile:
    Overall Score: 59/100 ████████████░░░░░░░░ 59%
    Quality       ████████████████ 100%
    Automation    ████████████████ 100%
    AI            ████████████░░░░  75%
    Documentation ████░░░░░░░░░░░░  25%

  📊 Complexity: 12/20`}</pre>
          <p className="text-xs text-text-muted">
            The maturity score shows where your project is strong (quality, automation) and where to improve (documentation).
          </p>
        </div>

        <div className="layer-card flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Run the full pipeline</h3>
          <div className="command-block">nexus run</div>
          <p className="text-xs text-text-muted">
            Executes 5 stages: Analyse → Score → Detect → Audit → Evolve. Run this periodically to track improvement.
          </p>
        </div>
      </section>

      <section className="layer-card flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-text-primary">Now explore your data</h2>
        <p className="text-sm text-text-secondary">
          This dashboard shows real data from your project. Navigate through the sections to see your governance health, architecture, and engineering state.
        </p>
        <Link to="/" className="text-sm text-accent hover:text-accent-hover transition-colors">
          Go to Dashboard Home →
        </Link>
      </section>

      <div className="flex gap-3">
        <Link to="/use/commands" className="btn btn-primary">
          All commands
        </Link>
        <Link to="/use/team-onboarding" className="btn btn-secondary">
          Joining a team?
        </Link>
      </div>
    </div>
  )
}
