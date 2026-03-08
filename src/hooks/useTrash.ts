import { useEffect } from 'react'
import { useTrashStore } from '@/stores/trashStore'

/**
 * Thin wrapper around the shared Zustand trash store.
 * All consumers share the same state — mutations are reflected everywhere immediately.
 */
export function useTrash() {
  const { items, isLoading, load, restore, deletePermanent, emptyTrash } = useTrashStore()

  // Load on first mount
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { items, isLoading, restore, deletePermanent, emptyTrash, refresh: load }
}
