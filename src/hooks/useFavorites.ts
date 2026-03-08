import { useEffect } from 'react'
import { useFavoritesStore } from '@/stores/favoritesStore'

/**
 * Thin wrapper around the shared Zustand favorites store.
 * All consumers share the same state — mutations are reflected everywhere immediately.
 */
export function useFavorites() {
  const { favorites, isLoading, load, addFavorite, removeFavorite } = useFavoritesStore()

  // Load on first mount (no-op if already loaded by another consumer)
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { favorites, isLoading, addFavorite, removeFavorite, refresh: load }
}
