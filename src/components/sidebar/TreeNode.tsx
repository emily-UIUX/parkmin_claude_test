import { useState, useRef, Fragment, type ComponentType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, NotebookPen } from 'lucide-react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { MoreMenu } from './MoreMenu'
import type { TreeNode as TreeNodeType, NodeAction, Notebook } from '@/types'
import { NOTEBOOK_ICON_MAP } from '@/lib/notebookIcons'
import { FolderOpenIcon } from '@/components/ui/folder-open'
import { BookTextIcon } from '@/components/ui/book-text'
import { MailCheckIcon } from '@/components/ui/mail-check'
import { BellIcon } from '@/components/ui/bell'
import { CalendarCheckIcon } from '@/components/ui/calendar-check'
import { FileTextIcon } from '@/components/ui/file-text'

// Animated icon map — used in expanded state for hover motion
const ANIMATED_ICON_MAP: Record<string, ComponentType<{ size?: number }>> = {
  'folder-open':    FolderOpenIcon    as ComponentType<{ size?: number }>,
  'book-text':      BookTextIcon      as ComponentType<{ size?: number }>,
  'mail-check':     MailCheckIcon     as ComponentType<{ size?: number }>,
  'bell':           BellIcon          as ComponentType<{ size?: number }>,
  'calendar-check': CalendarCheckIcon as ComponentType<{ size?: number }>,
  'file-text':      FileTextIcon      as ComponentType<{ size?: number }>,
}

// Gap drop zone rendered between sibling items
export function GapDropZone({ id }: { id: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'h-0.5 mx-2 rounded-full transition-colors duration-150',
        isOver ? 'bg-primary/50' : 'bg-transparent'
      )}
    />
  )
}


interface TreeNodeProps {
  node: TreeNodeType
  level: number
  activePageId: string | null
  favoritedIds: Set<string>
  onSelect: (node: TreeNodeType) => void
  onToggle: (nodeId: string) => void
  onAction: (nodeId: string, action: NodeAction) => void
  onLongPress?: (node: TreeNodeType) => void
  isDragOverlay?: boolean
}

export function TreeNode({
  node,
  level,
  activePageId,
  favoritedIds,
  onSelect,
  onToggle,
  onAction,
  onLongPress,
  isDragOverlay = false,
}: TreeNodeProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // Prevents row onClick (toggle/select) from firing after MoreMenu closes.
  // Radix portal can cause a fall-through click on the row when a menu item is clicked.
  const menuBlockRef = useRef(false)
  const handleMenuOpenChange = (open: boolean) => {
    setIsMenuOpen(open)
    if (open) {
      menuBlockRef.current = true
    } else {
      // Keep blocking for one tick so the fall-through click is swallowed
      setTimeout(() => { menuBlockRef.current = false }, 150)
    }
  }

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isNotebook = node.type === 'notebook'
  const isActive = node.type === 'page' && node.id === activePageId
  const currentColor = isNotebook ? (node.data as Notebook).color : ''

  // Static collapsed icon (or null → fallback to Folder)
  const iconPair = isNotebook && node.icon ? NOTEBOOK_ICON_MAP[node.icon] : null
  // Animated component for expanded state hover motion
  const AnimatedIcon = isNotebook && node.icon ? (ANIMATED_ICON_MAP[node.icon] ?? null) : null

  // ── DnD ──
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: node.id,
    disabled: isDragOverlay,
    data: { nodeType: node.type, depth: node.depth ?? 0 },
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    disabled: !isNotebook || isDragOverlay,
  })

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el)
    if (isNotebook) setDropRef(el)
  }

  const handleAction = (action: NodeAction) => {
    onAction(node.id, action)
  }

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => onLongPress?.(node), 500)
  }
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }

  const indent = level * 14 + 8

  // Icon element — expanded state uses animated hover icons, collapsed uses static icons
  const iconEl = isNotebook ? (
    <span
      className="flex-shrink-0 leading-none"
      style={currentColor ? { color: currentColor } : undefined}
    >
      {node.isExpanded ? (
        AnimatedIcon
          ? <AnimatedIcon size={16} />
          : <FolderOpenIcon size={16} />
      ) : (
        iconPair
          ? <iconPair.collapsed className="w-4 h-4" />
          : <Folder className="w-4 h-4" />
      )}
    </span>
  ) : (
    <span className="flex-shrink-0 leading-none">
      <NotebookPen className={cn('w-3.5 h-3.5', isActive ? 'text-primary/70' : 'text-muted-foreground/50')} />
    </span>
  )

  return (
    <div
      ref={setRef}
      className={cn('select-none', isDragging && 'opacity-30')}
    >
      {/* Row — drag listeners live here */}
      <div
        {...(!isDragOverlay ? attributes : {})}
        {...(!isDragOverlay ? listeners : {})}
        className={cn(
          'group relative flex items-center gap-2 py-1.5 rounded-md cursor-pointer',
          'transition-colors duration-100',
          isActive
            ? 'bg-primary/[0.06] text-primary'
            : 'text-foreground/75 hover:text-foreground hover:bg-muted/70',
          isMenuOpen && !isActive && 'bg-muted/70 text-foreground',
          isOver && isNotebook && 'ring-1 ring-primary/60 bg-primary/8'
        )}
        style={{ paddingLeft: indent, paddingRight: 6 }}
        onClick={() => {
          if (menuBlockRef.current) return
          if (isNotebook) onToggle(node.id)
          else onSelect(node)
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
      >
        {/* Icon */}
        {iconEl}

        {/* Title */}
        <span className={cn('flex-1 truncate text-[15px] leading-none', isActive && 'font-medium')}>
          {node.title}
        </span>

        {/* Page count badge (collapsed notebooks) */}
        {isNotebook && !node.isExpanded && (node.pageCount ?? 0) > 0 && (
          <span className="flex-shrink-0 text-[10px] text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded-full leading-none">
            {node.pageCount}
          </span>
        )}

        {/* More menu — hidden from layout (max-w-0) in default state so badge has no right gap */}
        <span
          className={cn(
            'flex-shrink-0 overflow-hidden transition-all duration-100',
            isMenuOpen
              ? 'max-w-[24px] opacity-100'
              : 'max-w-0 opacity-0 group-hover:max-w-[24px] group-hover:opacity-100'
          )}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MoreMenu node={node} onAction={handleAction} onOpenChange={handleMenuOpenChange} isFavorited={favoritedIds.has(node.id)} />
        </span>
      </div>

      {/* Children */}
      <AnimatePresence initial={false}>
        {isNotebook && node.isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <Fragment key={child.id}>
                <GapDropZone id={`gap:${child.id}`} />
                <TreeNode
                  node={child}
                  level={level + 1}
                  activePageId={activePageId}
                  favoritedIds={favoritedIds}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  onAction={onAction}
                  onLongPress={onLongPress}
                />
              </Fragment>
            ))}
            <GapDropZone id={`gap:end:${node.id}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
