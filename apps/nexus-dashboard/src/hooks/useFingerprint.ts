import { useState, useEffect } from 'react'
import { SOURCES } from '../data/sources'
import { fetchJson } from '../data/fetchers'
import type { Fingerprint } from '../data/types'

export function useFingerprint() {
  const [data, setData] = useState<Fingerprint | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchJson<Fingerprint>(SOURCES.fingerprint).then(d => {
      if (!cancelled) {
        setData(d)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  return { data, loading }
}
