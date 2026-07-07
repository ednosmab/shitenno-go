import { lazy, Suspense, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { BottomNav } from './components/layout/BottomNav'
import { Skeleton } from './components/shared/Skeleton'
import { routeTitles } from './data/navigation'

const WhatIsNexus = lazy(() => import('./pages/discover/WhatIsNexus'))
const WhyNexus = lazy(() => import('./pages/discover/WhyNexus'))
const WhoIsItFor = lazy(() => import('./pages/discover/WhoIsItFor'))
const GettingStarted = lazy(() => import('./pages/discover/GettingStarted'))

const Installation = lazy(() => import('./pages/use/Installation'))
const FirstSteps = lazy(() => import('./pages/use/FirstSteps'))
const Commands = lazy(() => import('./pages/use/Commands'))
const BestPractices = lazy(() => import('./pages/use/BestPractices'))
const TeamOnboarding = lazy(() => import('./pages/use/TeamOnboarding'))

const EngineeringState = lazy(() => import('./pages/concepts/EngineeringState'))
const ESM = lazy(() => import('./pages/concepts/ESM'))
const Capabilities = lazy(() => import('./pages/concepts/Capabilities'))
const Governance = lazy(() => import('./pages/concepts/Governance'))
const ArchitectureConcept = lazy(() => import('./pages/concepts/ArchitectureConcept'))
const Events = lazy(() => import('./pages/concepts/Events'))
const Policies = lazy(() => import('./pages/concepts/Policies'))
const Knowledge = lazy(() => import('./pages/concepts/Knowledge'))
const Evolution = lazy(() => import('./pages/concepts/Evolution'))

const Components = lazy(() => import('./pages/architecture/Components'))
const Responsibilities = lazy(() => import('./pages/architecture/Responsibilities'))
const Dependencies = lazy(() => import('./pages/architecture/Dependencies'))
const Flows = lazy(() => import('./pages/architecture/Flows'))
const DomainModel = lazy(() => import('./pages/architecture/DomainModel'))
const SystemStructure = lazy(() => import('./pages/architecture/SystemStructure'))

const SourceCode = lazy(() => import('./pages/engineering/SourceCode'))
const Modules = lazy(() => import('./pages/engineering/Modules'))
const Contracts = lazy(() => import('./pages/engineering/Contracts'))
const Interfaces = lazy(() => import('./pages/engineering/Interfaces'))
const ADRs = lazy(() => import('./pages/engineering/ADRs'))
const TechnicalGovernance = lazy(() => import('./pages/engineering/TechnicalGovernance'))
const EngineeringStateDetail = lazy(() => import('./pages/engineering/EngineeringStateDetail'))

const API = lazy(() => import('./pages/reference/API'))
const ContractsRef = lazy(() => import('./pages/reference/ContractsRef'))
const EventsRef = lazy(() => import('./pages/reference/EventsRef'))
const Types = lazy(() => import('./pages/reference/Types'))
const Configuration = lazy(() => import('./pages/reference/Configuration'))
const Schemas = lazy(() => import('./pages/reference/Schemas'))

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = routeTitles[location.pathname] ?? 'Nexus'

  return (
    <div className="flex h-dvh bg-surface-0">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-0">
        <Header onMenuToggle={() => setSidebarOpen(o => !o)} title={title} />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            <Suspense fallback={<div className="p-6"><Skeleton className="h-64" /></div>}>
              <Routes>
                <Route path="/" element={<WhatIsNexus />} />

                <Route path="/discover" element={<WhatIsNexus />} />
                <Route path="/discover/why" element={<WhyNexus />} />
                <Route path="/discover/who" element={<WhoIsItFor />} />
                <Route path="/discover/start" element={<GettingStarted />} />

                <Route path="/use" element={<Installation />} />
                <Route path="/use/first-steps" element={<FirstSteps />} />
                <Route path="/use/commands" element={<Commands />} />
                <Route path="/use/best-practices" element={<BestPractices />} />
                <Route path="/use/team-onboarding" element={<TeamOnboarding />} />

                <Route path="/concepts" element={<EngineeringState />} />
                <Route path="/concepts/esm" element={<ESM />} />
                <Route path="/concepts/capabilities" element={<Capabilities />} />
                <Route path="/concepts/governance" element={<Governance />} />
                <Route path="/concepts/architecture" element={<ArchitectureConcept />} />
                <Route path="/concepts/events" element={<Events />} />
                <Route path="/concepts/policies" element={<Policies />} />
                <Route path="/concepts/knowledge" element={<Knowledge />} />
                <Route path="/concepts/evolution" element={<Evolution />} />

                <Route path="/architecture" element={<Components />} />
                <Route path="/architecture/responsibilities" element={<Responsibilities />} />
                <Route path="/architecture/dependencies" element={<Dependencies />} />
                <Route path="/architecture/flows" element={<Flows />} />
                <Route path="/architecture/domain" element={<DomainModel />} />
                <Route path="/architecture/structure" element={<SystemStructure />} />

                <Route path="/engineering" element={<SourceCode />} />
                <Route path="/engineering/modules" element={<Modules />} />
                <Route path="/engineering/contracts" element={<Contracts />} />
                <Route path="/engineering/interfaces" element={<Interfaces />} />
                <Route path="/engineering/adrs" element={<ADRs />} />
                <Route path="/engineering/governance" element={<TechnicalGovernance />} />
                <Route path="/engineering/state" element={<EngineeringStateDetail />} />

                <Route path="/reference" element={<API />} />
                <Route path="/reference/contracts" element={<ContractsRef />} />
                <Route path="/reference/events" element={<EventsRef />} />
                <Route path="/reference/types" element={<Types />} />
                <Route path="/reference/config" element={<Configuration />} />
                <Route path="/reference/schemas" element={<Schemas />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
