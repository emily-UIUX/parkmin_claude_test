import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { FavoriteItem } from '@/types'

export interface FavoriteEntry extends FavoriteItem {
  title?: string
  type: 'notebook' | 'page'
}

interface FavoritesStore {
  favorites: FavoriteEntry[]
  isLoading: boolean
  load: () => Promise<void>
  addFavorite: (type: 'notebook' | 'page', itemId: string) => Promise<void>
  removeFavorite: (favoriteId: string) => Promise<void>
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: [],
  isLoading: true,

  load: async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { set({ isLoading: false }); return }

    const { data } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('sort_order')

    if (!data) { set({ isLoading: false }); return }

    const nbIds = data.filter((f) => f.notebook_id).map((f) => f.notebook_id)
    const pgIds = data.filter((f) => f.page_id).map((f) => f.page_id)

    const [nbRes, pgRes] = await Promise.all([
      nbIds.length
        ? supabase.from('notebooks').select('id, title').in('id', nbIds)
        : Promise.resolve({ data: [] }),
      pgIds.length
        ? supabase.from('pages').select('id, title').in('id', pgIds)
        : Promise.resolve({ data: [] }),
    ])

    const nbMap = new Map(
      (nbRes.data || []).map((n: { id: string; title: string }) => [n.id, n.title])
    )
    const pgMap = new Map(
      (pgRes.data || []).map((p: { id: string; title: string }) => [p.id, p.title])
    )

    set({
      favorites: data.map((f) => ({
        ...f,
        type: (f.notebook_id ? 'notebook' : 'page') as 'notebook' | 'page',
        title: f.notebook_id ? nbMap.get(f.notebook_id) : pgMap.get(f.page_id ?? ''),
      })),
      isLoading: false,
    })
  },

  addFavorite: async (type, itemId) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from('favorites').insert({
      user_id: userData.user.id,
      notebook_id: type === 'notebook' ? itemId : null,
      page_id: type === 'page' ? itemId : null,
      sort_order: get().favorites.length,
    })
    await get().load()
  },

  removeFavorite: async (favoriteId) => {
    await supabase.from('favorites').delete().eq('id', favoriteId)
    set((state) => ({ favorites: state.favorites.filter((f) => f.id !== favoriteId) }))
  },
}))
