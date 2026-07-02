import { useState, useEffect } from 'react'
import { SOURCES } from '../data/sources'
import { fetchJson } from '../data/fetchers'
import type { SessionBuffer } from '../data/types'

export function useSession() {
  const [data, setData] = useState<SessionBuffer | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchJson<SessionBuffer>(SOURCES.contextBuffer).then(d => {
      if (!cancelled) {
        setData(d)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
