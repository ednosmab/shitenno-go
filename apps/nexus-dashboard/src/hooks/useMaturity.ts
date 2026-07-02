import { useState, useEffect } from 'react'
import { SOURCES } from '../data/sources'
import { fetchJson } from '../data/fetchers'
import type { MaturityProfile, TelemetrySnapshot } from '../data/types'

export function useMaturity() {
  const [profile, setProfile] = useState<MaturityProfile | null>(null)
  const [history, setHistory] = useState<TelemetrySnapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [p, t1, t2] = await Promise.all([
        fetchJson<MaturityProfile>(SOURCES.maturityProfile),
        fetchJson<TelemetrySnapshot>(`${SOURCES.telemetryDir}/maturity-2026-06-30.json`),
        fetchJson<TelemetrySnapshot>(`${SOURCES.telemetryDir}/maturity-2026-07-01.json`),
      ])
      if (cancelled) return
      setProfile(p)
      const snaps = [t1, t2].filter(Boolean) as TelemetrySnapshot[]
      snaps.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      setHistory(snaps)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { profile, history, loading }
}
