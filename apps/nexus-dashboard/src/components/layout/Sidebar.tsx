import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Logo } from '../shared/Logo'

interface SubItem {
  to: string
  label: string
}

interface Layer {
  id: string
  icon: string
  label: string
  items: SubItem[]
}

const layers: Layer[] = [
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

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const toggleLayer = (id: string) => {
    setExpandedLayer(prev => prev === id ? null : id)
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-surface-1 border-r border-border-subtle
          transform transition-transform duration-200 ease-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border-subtle">
          <Logo size="sm" />
          <span className="text-sm font-semibold text-text-primary tracking-tight">Nexus</span>
          <span className="text-[10px] text-text-muted font-mono ml-auto">v0.1</span>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 overflow-y-auto h-[calc(100%-3.5rem-2.5rem)]">
          {layers.map(layer => {
            const isExpanded = expandedLayer === layer.id
            return (
              <div key={layer.id} className="flex flex-col">
                <button
                  onClick={() => toggleLayer(layer.id)}
                  className={[
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium',
                    'transition-all duration-150',
                    isExpanded
                      ? 'text-text-primary bg-surface-2'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-2/50',
                  ].join(' ')}
                >
                  <span className="w-5 text-center text-xs shrink-0">{layer.icon}</span>
                  <span className="flex-1 text-left">{layer.label}</span>
                  <span
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
                    className="text-[10px] text-text-muted shrink-0"
                  >
                    ▸
                  </span>
                </button>

                {isExpanded && (
                  <div
                    style={{ borderLeft: '2px solid var(--color-border-default)', marginLeft: '20px', paddingLeft: '12px', marginTop: '4px' }}
                    className="flex flex-col gap-0.5"
                  >
                    {layer.items.map(item => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end
                        onClick={onClose}
                        className={({ isActive }) => [
                          'block px-3 py-1.5 rounded-md text-[13px] transition-all duration-150',
                          isActive
                            ? 'text-accent font-semibold bg-accent-subtle/10'
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-2/50',
                        ].join(' ')}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border-subtle">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span>System operational</span>
          </div>
        </div>
      </aside>
    </>
  )
}
