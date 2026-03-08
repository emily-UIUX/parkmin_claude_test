import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useNavigationStore } from '@/stores/navigationStore'
import { useTreeStore } from '@/stores/treeStore'
import { useTrashStore } from '@/stores/trashStore'
import { buildTree } from '@/lib/tree-utils'
import type { Notebook, Page, TreeNode, NodeAction } from '@/types'

export function useNotebookTree() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { activePageId, setActivePageId } = useNavigationStore()

  // ── Load data ──
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user) { setIsLoading(false); return }
      const userId = sessionData.session.user.id

      const [nbRes, pgRes] = await Promise.all([
        supabase
          .from('notebooks')
          .select('*')
          .eq('user_id', userId)
          .eq('is_archived', false)
          .order('sort_order'),
        supabase
          .from('pages')
          .select('id, notebook_id, title, sort_order, is_pinned, is_deleted, deleted_at, created_at, updated_at')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .order('sort_order'),
      ])

      setNotebooks((nbRes.data as Notebook[]) || [])
      setPages((pgRes.data as Page[]) || [])
      setIsLoading(false)
    }

    load()
  }, [])

  // ── Realtime subscriptions ──
  useEffect(() => {
    const nbChannel = supabase
      .channel('notebooks-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notebooks' }, (payload) => {
        setNotebooks((prev) =>
          prev.some((n) => n.id === payload.new.id) ? prev : [...prev, payload.new as Notebook]
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notebooks' }, (payload) => {
        setNotebooks((prev) => prev.map((nb) => {
          if (nb.id !== payload.new.id) return nb
          // Preserve local is_expanded to prevent race condition between
          // toggleExpand and reorderNode DB writes closing the folder mid-drag
          return { ...(payload.new as Notebook), is_expanded: nb.is_expanded }
        }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notebooks' }, (payload) => {
        setNotebooks((prev) => prev.filter((nb) => nb.id !== payload.old.id))
      })
      .subscribe()

    const pgChannel = supabase
      .channel('pages-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pages' }, (payload) => {
        setPages((prev) =>
          prev.some((p) => p.id === payload.new.id) ? prev : [...prev, payload.new as Page]
        )
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pages' }, (payload) => {
        setPages((prev) => prev.map((p) => p.id === payload.new.id ? { ...p, ...payload.new } as Page : p))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pages' }, (payload) => {
        setPages((prev) => prev.filter((p) => p.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(nbChannel)
      supabase.removeChannel(pgChannel)
    }
  }, [])

  // ── Build tree ──
  const tree = useMemo(() => buildTree(notebooks, pages), [notebooks, pages])

  // useMemo 안에서 외부 store를 바꾸는 부수효과를 피하기 위해 useEffect 분리
  useEffect(() => {
    useTreeStore.getState().setTree(tree)
  }, [tree])

  // ── Toggle accordion ──
  const toggleExpand = useCallback(async (nodeId: string) => {
    const target = notebooks.find((n) => n.id === nodeId)
    if (!target) return
    const newExpanded = !target.is_expanded
    setNotebooks((prev) =>
      prev.map((nb) => nb.id === nodeId ? { ...nb, is_expanded: newExpanded } : nb)
    )
    await supabase.from('notebooks').update({ is_expanded: newExpanded }).eq('id', nodeId)
  }, [notebooks])

  // ── Select page ──
  const selectPage = useCallback((node: TreeNode) => {
    if (node.type === 'page') setActivePageId(node.id)
  }, [setActivePageId])

  // ── Rename ──
  const renameNode = useCallback(async (nodeId: string, type: 'notebook' | 'page', newTitle: string) => {
    if (type === 'notebook') {
      setNotebooks((prev) => prev.map((nb) => nb.id === nodeId ? { ...nb, title: newTitle } : nb))
      await supabase.from('notebooks').update({ title: newTitle }).eq('id', nodeId)
    } else {
      setPages((prev) => prev.map((p) => p.id === nodeId ? { ...p, title: newTitle } : p))
      await supabase.from('pages').update({ title: newTitle }).eq('id', nodeId)
    }
  }, [])

  // ── Action handler ──
  // 성공 여부를 반환 (true = 성공, false = 실패) — 호출측에서 toast 제어용
  const handleAction = useCallback(async (nodeId: string | null, action: NodeAction): Promise<boolean> => {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) {
      toast.error('로그인이 필요합니다')
      return false
    }

    switch (action) {
      case 'create-notebook': {
        const parent = nodeId ? notebooks.find((n) => n.id === nodeId) : null
        const { data, error } = await supabase
          .from('notebooks')
          .insert({
            parent_id: nodeId,
            title: '새 노트북',
            user_id: userId,
            color: '#7B68EE',
            icon: '📁',
            sort_order: notebooks.filter((n) => n.parent_id === nodeId).length,
          })
          .select()
          .single()
        if (error) { toast.error(`폴더 생성 실패: ${error.message}`); return false }
        if (data) {
          setNotebooks((prev) => [...prev, data as Notebook])
          if (nodeId && parent) {
            setNotebooks((prev) =>
              prev.map((nb) => nb.id === nodeId ? { ...nb, is_expanded: true } : nb)
            )
            await supabase.from('notebooks').update({ is_expanded: true }).eq('id', nodeId)
          }
          return true
        }
        return false
      }

      case 'create-page': {
        if (!nodeId) return false
        const { data, error: pageError } = await supabase
          .from('pages')
          .insert({
            notebook_id: nodeId,
            user_id: userId,
            title: '새 페이지',
            sort_order: pages.filter((p) => p.notebook_id === nodeId).length,
          })
          .select()
          .single()
        if (pageError) { toast.error(`페이지 생성 실패: ${pageError.message}`); return false }
        if (data) {
          setPages((prev) => [...prev, data as Page])
          setActivePageId(data.id)
          setNotebooks((prev) =>
            prev.map((nb) => nb.id === nodeId ? { ...nb, is_expanded: true } : nb)
          )
          await supabase.from('notebooks').update({ is_expanded: true }).eq('id', nodeId)
          return true
        }
        return false
      }

      case 'archive': {
        if (!nodeId) return false
        const nb = notebooks.find((n) => n.id === nodeId)
        const pg = pages.find((p) => p.id === nodeId)
        if (nb) {
          await supabase.from('trash').insert({
            user_id: userId,
            item_type: 'notebook',
            item_id: nodeId,
            original_parent_id: nb.parent_id,
            title: nb.title,
          })
          await supabase.from('notebooks').update({ is_archived: true }).eq('id', nodeId)
          setNotebooks((prev) => prev.filter((n) => n.id !== nodeId))
        } else if (pg) {
          await supabase.from('trash').insert({
            user_id: userId,
            item_type: 'page',
            item_id: nodeId,
            original_parent_id: pg.notebook_id,
            title: pg.title,
          })
          await supabase.from('pages').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', nodeId)
          setPages((prev) => prev.filter((p) => p.id !== nodeId))
          if (activePageId === nodeId) setActivePageId(null)
        }
        useTrashStore.getState().load()
        return true
      }

      case 'duplicate': {
        if (!nodeId) return false
        const pg = pages.find((p) => p.id === nodeId)
        if (pg) {
          const { data: fullPage } = await supabase.from('pages').select('*').eq('id', nodeId).single()
          if (fullPage) {
            const { error: dupError } = await supabase.from('pages').insert({
              notebook_id: fullPage.notebook_id,
              title: `${fullPage.title} (복사본)`,
              content: fullPage.content,
              plain_text_content: fullPage.plain_text_content,
              sort_order: (fullPage.sort_order ?? 0) + 1,
            })
            if (dupError) { toast.error(`복제 실패: ${dupError.message}`); return false }
            return true
          }
        }
        return false
      }

      default:
        return false
    }
  }, [notebooks, pages, activePageId, setActivePageId])

  // ── Update color/icon ──
  const updateNotebookColor = useCallback(async (notebookId: string, color: string) => {
    setNotebooks((prev) => prev.map((nb) => nb.id === notebookId ? { ...nb, color } : nb))
    await supabase.from('notebooks').update({ color }).eq('id', notebookId)
  }, [])

  const updateNotebookIcon = useCallback(async (notebookId: string, icon: string) => {
    setNotebooks((prev) => prev.map((nb) => nb.id === notebookId ? { ...nb, icon } : nb))
    await supabase.from('notebooks').update({ icon }).eq('id', notebookId)
  }, [])

  // ── Move node ──
  const moveNode = useCallback(async (nodeId: string, type: 'notebook' | 'page', targetNotebookId: string | null) => {
    if (type === 'notebook') {
      setNotebooks((prev) => prev.map((nb) => nb.id === nodeId ? { ...nb, parent_id: targetNotebookId } : nb))
      await supabase.from('notebooks').update({ parent_id: targetNotebookId }).eq('id', nodeId)
    } else {
      if (!targetNotebookId) return
      setPages((prev) => prev.map((p) => p.id === nodeId ? { ...p, notebook_id: targetNotebookId } : p))
      await supabase.from('pages').update({ notebook_id: targetNotebookId }).eq('id', nodeId)
    }
  }, [])

  // ── Reorder node (between-item drop) ──
  const reorderNode = useCallback(async (
    nodeId: string,
    type: 'notebook' | 'page',
    newParentId: string | null,
    insertBeforeId: string | null,
  ) => {
    if (type === 'notebook') {
      const current = notebooks.find((n) => n.id === nodeId)
      if (!current) return
      const siblings = notebooks
        .filter((n) => n.parent_id === newParentId && n.id !== nodeId)
        .sort((a, b) => a.sort_order - b.sort_order)
      const insertIdx = insertBeforeId !== null
        ? siblings.findIndex((n) => n.id === insertBeforeId)
        : siblings.length
      const finalIdx = insertIdx === -1 ? siblings.length : insertIdx
      const reordered = [...siblings]
      reordered.splice(finalIdx, 0, { ...current, parent_id: newParentId })
      const updates = reordered.map((nb, idx) => ({ id: nb.id, sort_order: idx, parent_id: newParentId }))
      setNotebooks((prev) => prev.map((nb) => {
        const upd = updates.find((u) => u.id === nb.id)
        return upd ? { ...nb, sort_order: upd.sort_order, parent_id: newParentId } : nb
      }))
      await Promise.all(updates.map((upd) =>
        supabase.from('notebooks').update({ sort_order: upd.sort_order, parent_id: upd.parent_id }).eq('id', upd.id)
      ))
    } else {
      if (newParentId === null) return
      const current = pages.find((p) => p.id === nodeId)
      if (!current) return
      const siblings = pages
        .filter((p) => p.notebook_id === newParentId && p.id !== nodeId)
        .sort((a, b) => a.sort_order - b.sort_order)
      const insertIdx = insertBeforeId !== null
        ? siblings.findIndex((p) => p.id === insertBeforeId)
        : siblings.length
      const finalIdx = insertIdx === -1 ? siblings.length : insertIdx
      const reordered = [...siblings]
      reordered.splice(finalIdx, 0, { ...current, notebook_id: newParentId })
      const updates = reordered.map((p, idx) => ({ id: p.id, sort_order: idx, notebook_id: newParentId }))
      setPages((prev) => prev.map((p) => {
        const upd = updates.find((u) => u.id === p.id)
        return upd ? { ...p, sort_order: upd.sort_order, notebook_id: newParentId } : p
      }))
      await Promise.all(updates.map((upd) =>
        supabase.from('pages').update({ sort_order: upd.sort_order, notebook_id: upd.notebook_id }).eq('id', upd.id)
      ))
    }
  }, [notebooks, pages])

  return {
    tree,
    notebooks,
    pages,
    activePageId,
    selectPage,
    toggleExpand,
    handleAction,
    renameNode,
    updateNotebookColor,
    updateNotebookIcon,
    moveNode,
    reorderNode,
    isLoading,
  }
}
