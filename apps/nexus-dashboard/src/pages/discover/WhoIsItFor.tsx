import { Link } from 'react-router-dom'

const profiles = [
  {
    size: 'Solo',
    icon: '◈',
    description: 'Working alone, losing context between sessions.',
    daily: 'You close your laptop mid-feature. Next day, you spend 20 minutes re-reading files to remember where you were. Nexus preserves your state so you resume in 30 seconds.',
  },
  {
    size: '2-5 people',
    icon: '◆',
    description: 'Small team where knowledge lives in one person\'s head.',
    daily: 'Your senior leaves for vacation. Nobody knows why that architectural decision was made. Nexus makes decisions explicit and verifiable — the team doesn\'t depend on one person\'s memory.',
  },
  {
    size: '5-15 people',
    icon: '⬡',
    description: 'Growing team where onboarding takes weeks.',
    daily: 'A new developer joins. They ask "where do I start?" and get pointed to 15 different files. Nexus gives them a single command that summarizes the entire project state.',
  },
  {
    size: 'AI-assisted teams',
    icon: '▣',
    description: 'Teams where AI agents operate without governance context.',
    daily: 'Your AI agent generates code that violates patterns established 3 months ago. Nexus feeds agents governed context so they respect your conventions.',
  },
]

export default function WhoIsItFor() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Who is this for?</h1>
        <p className="text-text-secondary max-w-2xl">
          Nexus works for any team size. The value scales with complexity — but even solo developers feel the difference on day one.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        {profiles.map(profile => (
          <div key={profile.size} className="layer-card space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-accent text-lg">{profile.icon}</span>
              <h3 className="text-sm font-semibold text-text-primary">{profile.size}</h3>
            </div>
            <p className="text-sm text-text-secondary">{profile.description}</p>
            <div className="bg-surface-2 rounded-lg p-3">
              <p className="text-xs text-text-muted leading-relaxed">{profile.daily}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="layer-card space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Joining a team that already uses Nexus?</h2>
        <p className="text-sm text-text-secondary">
          If you just joined a project that runs Nexus, you don't need to read everything. One command gives you the full picture.
        </p>
        <Link to="/use/team-onboarding" className="text-sm text-accent hover:text-accent-hover transition-colors">
          Team Onboarding Guide →
        </Link>
      </section>

      <Link to="/discover/start" className="inline-flex px-4 py-2 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors">
        Get started
      </Link>
    </div>
  )
}
