import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { TrashItem } from '@/types'

interface TrashStore {
  items: TrashItem[]
  isLoading: boolean
  load: () => Promise<void>
  restore: (item: TrashItem) => Promise<void>
  deletePermanent: (item: TrashItem) => Promise<void>
  emptyTrash: () => Promise<void>
}

export const useTrashStore = create<TrashStore>((set, get) => ({
  items: [],
  isLoading: true,

  load: async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { set({ isLoading: false }); return }

    const { data } = await supabase
      .from('trash')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('deleted_at', { ascending: false })

    const items: TrashItem[] = (data as TrashItem[]) || []

    // Enrich notebook items with icon & color from notebooks table
    const notebookIds = items
      .filter((i) => i.item_type === 'notebook')
      .map((i) => i.item_id)

    if (notebookIds.length > 0) {
      const { data: notebooks } = await supabase
        .from('notebooks')
        .select('id, icon, color')
        .in('id', notebookIds)

      if (notebooks) {
        const nbMap = Object.fromEntries(notebooks.map((n) => [n.id, n]))
        items.forEach((item) => {
          if (item.item_type === 'notebook' && nbMap[item.item_id]) {
            item.icon = nbMap[item.item_id].icon ?? null
            item.color = nbMap[item.item_id].color ?? null
          }
        })
      }
    }

    set({ items, isLoading: false })
  },

  restore: async (item) => {
    if (item.item_type === 'notebook') {
      await supabase
        .from('notebooks')
        .update({ is_archived: false, parent_id: item.original_parent_id })
        .eq('id', item.item_id)
    } else {
      await supabase
        .from('pages')
        .update({ is_deleted: false, deleted_at: null })
        .eq('id', item.item_id)
    }
    await supabase.from('trash').delete().eq('id', item.id)
    set((state) => ({ items: state.items.filter((t) => t.id !== item.id) }))
  },

  deletePermanent: async (item) => {
    if (item.item_type === 'notebook') {
      await supabase.from('notebooks').delete().eq('id', item.item_id)
    } else {
      await supabase.from('pages').delete().eq('id', item.item_id)
    }
    await supabase.from('trash').delete().eq('id', item.id)
    set((state) => ({ items: state.items.filter((t) => t.id !== item.id) }))
  },

  emptyTrash: async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    for (const item of get().items) {
      if (item.item_type === 'notebook') {
        await supabase.from('notebooks').delete().eq('id', item.item_id)
      } else {
        await supabase.from('pages').delete().eq('id', item.item_id)
      }
    }
    await supabase.from('trash').delete().eq('user_id', userData.user.id)
    set({ items: [] })
  },
}))
