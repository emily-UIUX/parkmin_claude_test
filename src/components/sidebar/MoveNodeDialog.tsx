import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Folder, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TreeNode } from '@/types'
import { MAX_NOTEBOOK_DEPTH } from '@/lib/constants'

interface MoveNodeDialogProps {
  open: boolean
  onClose: () => void
  onMove: (targetNotebookId: string | null) => void
  tree: TreeNode[]
  movingNode: TreeNode | null
}

export function MoveNodeDialog({ open, onClose, onMove, tree, movingNode }: MoveNodeDialogProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const isDisabled = (node: TreeNode) => {
    if (!movingNode) return false
    if (node.id === movingNode.id) return true
    if (node.id === movingNode.parentId) return true
    // Can't move notebook to target that would exceed max depth
    if (movingNode.type === 'notebook' && node.type === 'notebook') {
      if (node.depth >= MAX_NOTEBOOK_DEPTH) return true
    }
    return false
  }

  const renderNodes = (nodes: TreeNode[], level = 0) => {
    return nodes
      .filter((n) => n.type === 'notebook')
      .map((node) => (
        <div key={node.id}>
          <button
            onClick={() => !isDisabled(node) && setSelected(node.id)}
            disabled={isDisabled(node)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              'hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed',
              selected === node.id && 'bg-primary/10 text-primary'
            )}
            style={{ paddingLeft: `${level * 16 + 12}px` }}
          >
            <Folder className="w-4 h-4 flex-shrink-0" style={{ color: node.color }} />
            <span className="truncate">{node.title}</span>
          </button>
          {node.children.filter(c => c.type === 'notebook').length > 0 && (
            renderNodes(node.children, level + 1)
          )}
        </div>
      ))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>이동 위치 선택</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-72 border rounded-md">
          <div className="p-2">
            <button
              onClick={() => setSelected(null)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent',
                selected === null && 'bg-primary/10 text-primary'
              )}
            >
              <ChevronRight className="w-4 h-4" />
              루트 (최상위)
            </button>
            {renderNodes(tree)}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={() => { onMove(selected); onClose() }}>이동</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
