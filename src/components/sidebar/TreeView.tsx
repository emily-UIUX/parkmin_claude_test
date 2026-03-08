import { Fragment, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { TreeNode, GapDropZone } from './TreeNode'
import { EmptyTreeState } from './EmptyTreeState'
import { NotebookEditDialog } from './NotebookEditDialog'
import { useNotebookTree } from '@/hooks/useNotebookTree'
import { useFavorites } from '@/hooks/useFavorites'
import { Skeleton } from '@/components/ui/skeleton'
import { findNodeById, flattenTree } from '@/lib/tree-utils'
import { MAX_NOTEBOOK_DEPTH } from '@/lib/constants'
import type { NodeAction, TreeNode as TreeNodeType, Notebook, Page } from '@/types'
import { Folder } from 'lucide-react'

const ACTION_TOASTS: Partial<Record<NodeAction, string>> = {
  'archive': '아카이브했습니다',
  'create-notebook': '폴더를 만들었습니다',
  'create-page': '새 페이지를 만들었습니다',
  'duplicate': '복제했습니다',
}

export function TreeView() {
  const {
    tree,
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
  } = useNotebookTree()

  const { favorites, addFavorite, removeFavorite } = useFavorites()
  const favoritedIds = new Set(
    favorites.map((f) => f.notebook_id ?? f.page_id).filter((id): id is string => !!id)
  )
  const favoriteIdByItemId = new Map(
    favorites.map((f) => [(f.notebook_id ?? f.page_id)!, f.id])
  )

  // ── Edit dialog state ──
  const [editDialogNode, setEditDialogNode] = useState<TreeNodeType | null>(null)

  // ── DnD state ──
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const activeDragNode = activeDragId ? findNodeById(tree, activeDragId) : null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDragId(active.id as string)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    const draggedId = active.id as string
    const overId = over.id as string

    const draggedNode = findNodeById(tree, draggedId)
    if (!draggedNode) return

    // ── Gap (between-item) drop ──
    if (overId.startsWith('gap:')) {
      const gapTarget = overId.slice(4)

      if (gapTarget.startsWith('end:')) {
        const parentPart = gapTarget.slice(4)
        const parentId = parentPart === 'root' ? null : parentPart

        if (parentId === null) {
          if (draggedNode.type !== 'notebook') return
          reorderNode(draggedId, 'notebook', null, null)
          toast.success('이동했습니다')
        } else {
          const parentNode = findNodeById(tree, parentId)
          if (!parentNode || parentNode.type !== 'notebook') return
          if (draggedNode.type === 'notebook') {
            reorderNode(draggedId, 'notebook', parentId, null)
          } else {
            reorderNode(draggedId, 'page', parentId, null)
          }
          toast.success('이동했습니다')
        }
      } else {
        const beforeNodeId = gapTarget
        const beforeNode = findNodeById(tree, beforeNodeId)
        if (!beforeNode) return
        if (draggedNode.type !== beforeNode.type) return

        if (draggedNode.type === 'notebook') {
          reorderNode(draggedId, 'notebook', beforeNode.parentId, beforeNodeId)
          toast.success('폴더를 이동했습니다')
        } else {
          const beforePage = beforeNode.data as Page
          reorderNode(draggedId, 'page', beforePage.notebook_id, beforeNodeId)
          toast.success('페이지를 이동했습니다')
        }
      }
      return
    }

    // ── Drop INTO notebook ──
    const targetNode = findNodeById(tree, overId)
    if (!targetNode || targetNode.type !== 'notebook') return

    const descendants = flattenTree([draggedNode])
    if (descendants.some((d) => d.id === overId)) return

    if (draggedNode.type === 'notebook') {
      if ((targetNode.depth ?? 0) >= MAX_NOTEBOOK_DEPTH) {
        toast.error('최대 4단계까지만 중첩할 수 있습니다')
        return
      }
      if ((draggedNode.data as Notebook).parent_id === overId) return
      moveNode(draggedId, 'notebook', overId)
      toast.success('폴더를 이동했습니다')
    } else {
      const currentNotebookId = (draggedNode.data as { notebook_id: string }).notebook_id
      if (currentNotebookId === overId) return
      moveNode(draggedId, 'page', overId)
      toast.success('페이지를 이동했습니다')
    }
  }

  const dispatchAction = async (nodeId: string, action: NodeAction) => {
    if (action === 'toggle-favorite') {
      const node = findNodeById(tree, nodeId)
      if (!node) return
      if (favoritedIds.has(nodeId)) {
        const favId = favoriteIdByItemId.get(nodeId)
        if (favId) removeFavorite(favId)
        toast.success('즐겨찾기에서 제거했습니다')
      } else {
        addFavorite(node.type, nodeId)
        toast.success('즐겨찾기에 추가했습니다')
      }
      return
    }
    if (action === 'edit-notebook') {
      const node = findNodeById(tree, nodeId)
      if (node) setEditDialogNode(node)
      return
    }
    // handleAction이 실제로 성공해야 toast 표시 (먹통 방지)
    const ok = await handleAction(nodeId, action)
    if (ok) {
      const msg = ACTION_TOASTS[action]
      if (msg) toast.success(msg)
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-2 space-y-1">
        {[...Array(6)].map((_, i) => (
          <Skeleton
            key={i}
            className="h-7 rounded-md"
            style={{ marginLeft: `${(i % 3) * 16}px`, opacity: 1 - i * 0.12 }}
          />
        ))}
      </div>
    )
  }

  if (tree.length === 0) {
    return <EmptyTreeState onCreate={() => handleAction(null, 'create-notebook')} />
  }

  return (
    <>
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0">
        <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider leading-none">
          노트북
        </span>
        <button
          onClick={() => handleAction(null, 'create-notebook')}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          title="새 폴더"
        >
          <Plus className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Tree + DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <div className="flex-1 overflow-y-auto scroll-container py-0.5 px-1.5">
          {tree.map((rootNode) => (
            <Fragment key={rootNode.id}>
              <GapDropZone id={`gap:${rootNode.id}`} />
              <TreeNode
                node={rootNode}
                level={0}
                activePageId={activePageId}
                favoritedIds={favoritedIds}
                onSelect={selectPage}
                onToggle={toggleExpand}
                onAction={dispatchAction}
                onLongPress={(node) => toast.info(node.title)}
              />
            </Fragment>
          ))}
          <GapDropZone id="gap:end:root" />
        </div>

        {/* Ghost overlay while dragging */}
        <DragOverlay dropAnimation={null}>
          {activeDragNode && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background border border-primary/30 rounded-md shadow-lg text-sm opacity-90 pointer-events-none">
              <Folder className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="truncate max-w-[180px]">{activeDragNode.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <NotebookEditDialog
        open={editDialogNode !== null}
        node={editDialogNode}
        onClose={() => setEditDialogNode(null)}
        onSave={(nodeId, { title, color, icon }) => {
          renameNode(nodeId, 'notebook', title)
          updateNotebookColor(nodeId, color)
          updateNotebookIcon(nodeId, icon)
          toast.success('노트북이 수정됐습니다')
        }}
      />
    </>
  )
}
