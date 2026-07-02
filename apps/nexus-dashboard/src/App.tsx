import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { BottomNav } from './components/layout/BottomNav'

import WhatIsNexus from './pages/discover/WhatIsNexus'
import WhyNexus from './pages/discover/WhyNexus'
import WhoIsItFor from './pages/discover/WhoIsItFor'
import GettingStarted from './pages/discover/GettingStarted'

import Installation from './pages/use/Installation'
import FirstSteps from './pages/use/FirstSteps'
import Commands from './pages/use/Commands'
import BestPractices from './pages/use/BestPractices'

import EngineeringState from './pages/concepts/EngineeringState'
import ESM from './pages/concepts/ESM'
import Capabilities from './pages/concepts/Capabilities'
import Governance from './pages/concepts/Governance'
import ArchitectureConcept from './pages/concepts/ArchitectureConcept'
import Events from './pages/concepts/Events'
import Policies from './pages/concepts/Policies'
import Knowledge from './pages/concepts/Knowledge'
import Evolution from './pages/concepts/Evolution'

import Components from './pages/architecture/Components'
import Responsibilities from './pages/architecture/Responsibilities'
import Dependencies from './pages/architecture/Dependencies'
import Flows from './pages/architecture/Flows'
import DomainModel from './pages/architecture/DomainModel'
import SystemStructure from './pages/architecture/SystemStructure'

import SourceCode from './pages/engineering/SourceCode'
import Modules from './pages/engineering/Modules'
import Contracts from './pages/engineering/Contracts'
import Interfaces from './pages/engineering/Interfaces'
import ADRs from './pages/engineering/ADRs'
import TechnicalGovernance from './pages/engineering/TechnicalGovernance'
import EngineeringStateDetail from './pages/engineering/EngineeringStateDetail'

import API from './pages/reference/API'
import ContractsRef from './pages/reference/ContractsRef'
import EventsRef from './pages/reference/EventsRef'
import Types from './pages/reference/Types'
import Configuration from './pages/reference/Configuration'
import Schemas from './pages/reference/Schemas'

const titles: Record<string, string> = {
  '/': 'Nexus Dashboard',
  '/discover': 'O que e o Nexus',
  '/discover/why': 'Por que existe',
  '/discover/who': 'Para quem',
  '/discover/start': 'Comecar',
  '/use': 'Instalacao',
  '/use/first-steps': 'Primeiros passos',
  '/use/commands': 'Comandos',
  '/use/best-practices': 'Boas praticas',
  '/concepts': 'Engineering State',
  '/concepts/esm': 'ESM',
  '/concepts/capabilities': 'Capabilities',
  '/concepts/governance': 'Governanca',
  '/concepts/architecture': 'Arquitetura',
  '/concepts/events': 'Eventos',
  '/concepts/policies': 'Politicas',
  '/concepts/knowledge': 'Conhecimento',
  '/concepts/evolution': 'Evolucao',
  '/architecture': 'Componentes',
  '/architecture/responsibilities': 'Responsabilidades',
  '/architecture/dependencies': 'Dependencias',
  '/architecture/flows': 'Fluxos',
  '/architecture/domain': 'Modelo de Dominio',
  '/architecture/structure': 'Estrutura',
  '/engineering': 'Codigo',
  '/engineering/modules': 'Modulos',
  '/engineering/contracts': 'Contratos',
  '/engineering/interfaces': 'Interfaces',
  '/engineering/adrs': 'ADRs',
  '/engineering/governance': 'Governanca Tecnica',
  '/engineering/state': 'Estado Detalhado',
  '/reference': 'API',
  '/reference/contracts': 'Contratos',
  '/reference/events': 'Eventos',
  '/reference/types': 'Tipos',
  '/reference/config': 'Configuracao',
  '/reference/schemas': 'Esquemas',
}

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = titles[location.pathname] ?? 'Nexus'

  return (
    <div className="flex h-dvh bg-surface-0">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-0">
        <Header onMenuToggle={() => setSidebarOpen(o => !o)} title={title} />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
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
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
