import { useState, useEffect } from 'react'
import { SOURCES } from '../data/sources'
import { fetchJson } from '../data/fetchers'
import type { ComplexityReport } from '../data/types'

export function useComplexity() {
  const [reports, setReports] = useState<ComplexityReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const urls = [
        `${SOURCES.reportsDir}/complexity---2026-06-30-session1.json`,
        `${SOURCES.reportsDir}/complexity-nexus-cli-2026-07-01-session1.json`,
        `${SOURCES.reportsDir}/complexity-nexus-cli-2026-07-01-session2.json`,
        `${SOURCES.reportsDir}/complexity-nexus-cli-2026-07-01-session3.json`,
        `${SOURCES.reportsDir}/complexity-nexus-cli-2026-07-01-session4.json`,
        `${SOURCES.reportsDir}/complexity-nexus-cli-2026-07-01-session5.json`,
      ]
      const results = await Promise.all(urls.map(u => fetchJson<ComplexityReport>(u)))
      if (cancelled) return
      const valid = results.filter(Boolean) as ComplexityReport[]
      valid.sort((a, b) => new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime())
      setReports(valid)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { reports, loading }
}
