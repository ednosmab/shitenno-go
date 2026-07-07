export interface SubItem {
  to: string
  label: string
}

export interface Layer {
  id: string
  icon: string
  label: string
  items: SubItem[]
}

export const layers: Layer[] = [
  {
    id: 'discover',
    icon: '◈',
    label: 'Descubra',
    items: [
      { to: '/discover', label: 'O que e o Nexus' },
      { to: '/discover/who', label: 'Para quem' },
      { to: '/discover/start', label: 'Comecar' },
      { to: '/discover/why', label: 'Por que existe' },
    ],
  },
  {
    id: 'use',
    icon: '◎',
    label: 'Utilize',
    items: [
      { to: '/use', label: 'Instalacao' },
      { to: '/use/first-steps', label: 'Primeiros passos' },
      { to: '/use/commands', label: 'Comandos' },
      { to: '/use/best-practices', label: 'Boas praticas' },
      { to: '/use/team-onboarding', label: 'Team Onboarding' },
    ],
  },
  {
    id: 'concepts',
    icon: '◆',
    label: 'Entenda',
    items: [
      { to: '/concepts', label: 'Engineering State' },
      { to: '/concepts/esm', label: 'ESM' },
      { to: '/concepts/capabilities', label: 'Capabilities' },
      { to: '/concepts/governance', label: 'Governanca' },
      { to: '/concepts/architecture', label: 'Arquitetura' },
      { to: '/concepts/events', label: 'Eventos' },
      { to: '/concepts/policies', label: 'Politicas' },
      { to: '/concepts/knowledge', label: 'Conhecimento' },
      { to: '/concepts/evolution', label: 'Evolucao' },
    ],
  },
  {
    id: 'architecture',
    icon: '⬡',
    label: 'Arquitetura',
    items: [
      { to: '/architecture', label: 'Componentes' },
      { to: '/architecture/responsibilities', label: 'Responsabilidades' },
      { to: '/architecture/dependencies', label: 'Dependencias' },
      { to: '/architecture/flows', label: 'Fluxos' },
      { to: '/architecture/domain', label: 'Modelo de Dominio' },
      { to: '/architecture/structure', label: 'Estrutura' },
    ],
  },
  {
    id: 'engineering',
    icon: '▣',
    label: 'Engenharia',
    items: [
      { to: '/engineering', label: 'Codigo' },
      { to: '/engineering/modules', label: 'Modulos' },
      { to: '/engineering/contracts', label: 'Contratos' },
      { to: '/engineering/interfaces', label: 'Interfaces' },
      { to: '/engineering/adrs', label: 'ADRs' },
      { to: '/engineering/governance', label: 'Governanca Tecnica' },
      { to: '/engineering/state', label: 'Estado Detalhado' },
    ],
  },
  {
    id: 'reference',
    icon: '⊞',
    label: 'Referencia',
    items: [
      { to: '/reference', label: 'API' },
      { to: '/reference/contracts', label: 'Contratos' },
      { to: '/reference/events', label: 'Eventos' },
      { to: '/reference/types', label: 'Tipos' },
      { to: '/reference/config', label: 'Configuracao' },
      { to: '/reference/schemas', label: 'Esquemas' },
    ],
  },
]

export const breadcrumbMap: Record<string, string> = Object.fromEntries(
  layers.map(l => [l.id, l.label])
)

export const subPageMap: Record<string, string> = Object.fromEntries(
  layers.flatMap(l =>
    l.items.map(item => {
      const slug = item.to.split('/').pop() ?? ''
      return [slug, item.label]
    })
  )
)

export const routeTitles: Record<string, string> = {
  '/': 'Nexus Dashboard',
  ...Object.fromEntries(
    layers.flatMap(l =>
      l.items.map(item => [item.to, item.label])
    )
  ),
}
