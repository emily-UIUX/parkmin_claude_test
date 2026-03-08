import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  FolderPlus,
  FilePlus,
  Settings2,
  Copy,
  Archive,
  Star,
} from 'lucide-react'
import type { TreeNode, NodeAction } from '@/types'
import { MAX_NOTEBOOK_DEPTH } from '@/lib/constants'

interface MoreMenuProps {
  node: TreeNode
  onAction: (action: NodeAction) => void
  onOpenChange?: (open: boolean) => void
  isFavorited?: boolean
}

export function MoreMenu({ node, onAction, onOpenChange, isFavorited }: MoreMenuProps) {
  const isNotebook = node.type === 'notebook'
  const canCreateChild = isNotebook && node.depth < MAX_NOTEBOOK_DEPTH

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className="tree-action-btn w-6 h-6 flex items-center justify-center rounded hover:bg-accent/80 transition-colors"
          onClick={(e) => e.stopPropagation()}
          title="더 보기"
        >
          <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-52 z-50">
        {/* Create actions (notebooks only) */}
        {isNotebook && (
          <>
            {canCreateChild && (
              <DropdownMenuItem onClick={() => onAction('create-notebook')}>
                <FolderPlus className="w-4 h-4 mr-2" /> 하위 노트북 만들기
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onAction('create-page')}>
              <FilePlus className="w-4 h-4 mr-2" /> 새 페이지 만들기
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Notebook edit (opens dialog with name/color/icon) */}
        {isNotebook && (
          <>
            <DropdownMenuItem onClick={() => onAction('edit-notebook')}>
              <Settings2 className="w-4 h-4 mr-2" /> 노트북 편집
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Management actions */}
        <DropdownMenuItem onClick={() => onAction('duplicate')}>
          <Copy className="w-4 h-4 mr-2" /> 복제
        </DropdownMenuItem>
        {!isNotebook && (
          <DropdownMenuItem onClick={() => onAction('toggle-favorite')}>
            <Star className={`w-4 h-4 mr-2 ${isFavorited ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            {isFavorited ? '즐겨찾기 해제' : '즐겨찾기'}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onAction('archive')}>
          <Archive className="w-4 h-4 mr-2" /> 아카이브
        </DropdownMenuItem>

      </DropdownMenuContent>
    </DropdownMenu>
  )
}
