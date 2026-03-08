import { useEffect } from 'react'
import { useRecentStore } from '@/stores/recentStore'

/**
 * Thin wrapper around the shared Zustand recent-pages store.
 * All consumers share the same state — mutations are reflected everywhere immediately.
 */
export function useRecentPages() {
  const { recent, isLoading, load, trackPage } = useRecentStore()

  // Load on first mount
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { recent, isLoading, trackPage, refresh: load }
}
