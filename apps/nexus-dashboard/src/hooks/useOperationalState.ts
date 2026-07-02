import { useState, useEffect } from 'react'
import { SOURCES } from '../data/sources'
import { fetchJson } from '../data/fetchers'
import type { OperationalState } from '../data/types'

export function useOperationalState() {
  const [data, setData] = useState<OperationalState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchJson<OperationalState>(SOURCES.operationalState).then(d => {
      if (!cancelled) {
        setData(d)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
