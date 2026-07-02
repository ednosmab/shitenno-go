import { useState, useEffect } from 'react'
import { SOURCES } from '../data/sources'
import { fetchJson } from '../data/fetchers'
import type { FeedbackSummary } from '../data/types'

export function useFeedback() {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const s = await fetchJson<FeedbackSummary>(SOURCES.feedbackSummary)
      if (cancelled) return
      setSummary(s)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { summary, loading }
}
