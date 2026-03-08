import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Page } from '@/types'

export interface RecentPage extends Pick<Page, 'id' | 'title' | 'updated_at'> {
  viewed_at: string
  notebook_title?: string
}

interface RecentStore {
  recent: RecentPage[]
  isLoading: boolean
  load: () => Promise<void>
  trackPage: (pageId: string) => Promise<void>
}

export const useRecentStore = create<RecentStore>((set, get) => ({
  recent: [],
  isLoading: true,

  load: async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { set({ isLoading: false }); return }

    const { data } = await supabase
      .from('recent_pages')
      .select(`
        viewed_at,
        pages!inner(id, title, updated_at, is_deleted,
          notebooks!inner(title)
        )
      `)
      .eq('user_id', userData.user.id)
      .eq('pages.is_deleted', false)
      .order('viewed_at', { ascending: false })
      .limit(20)

    if (data) {
      set({
        recent: data.map((r: Record<string, unknown>) => {
          const page = r.pages as Record<string, unknown>
          const notebook = page?.notebooks as Record<string, unknown>
          return {
            id: page?.id as string,
            title: page?.title as string,
            updated_at: page?.updated_at as string,
            viewed_at: r.viewed_at as string,
            notebook_title: notebook?.title as string,
          }
        }),
        isLoading: false,
      })
    } else {
      set({ isLoading: false })
    }
  },

  trackPage: async (pageId) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    await supabase
      .from('recent_pages')
      .upsert(
        { user_id: userData.user.id, page_id: pageId, viewed_at: new Date().toISOString() },
        { onConflict: 'user_id,page_id' }
      )
    await get().load()
  },
}))
