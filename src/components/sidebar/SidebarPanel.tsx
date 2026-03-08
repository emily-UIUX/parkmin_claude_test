import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Folder, Minus, NotebookPen, RotateCcw, Trash } from 'lucide-react'
import { NOTEBOOK_ICON_MAP } from '@/lib/notebookIcons'
import type { TrashItem } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useRecentPages } from '@/hooks/useRecentPages'
import { useFavorites } from '@/hooks/useFavorites'
import { useTrash } from '@/hooks/useTrash'
import { useNavigationStore } from '@/stores/navigationStore'
import { toast } from 'sonner'

export type PanelType = 'favorites' | 'recent' | 'trash' | null

interface SidebarPanelProps {
  panel: PanelType
  onClose: () => void
}

export function SidebarPanel({ panel, onClose }: SidebarPanelProps) {
  return (
    <AnimatePresence>
      {panel && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 224, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="flex flex-col border-t border-border bg-sidebar overflow-hidden"
        >
          <div className="flex-1 overflow-hidden flex flex-col">
            {panel === 'favorites' && <div className="flex-1 overflow-y-auto scroll-container"><FavoritesContent onClose={onClose} /></div>}
            {panel === 'recent' && <div className="flex-1 overflow-y-auto scroll-container"><RecentContent onClose={onClose} /></div>}
            {panel === 'trash' && <TrashContent />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function FavoritesContent({ onClose }: { onClose: () => void }) {
  const { favorites, isLoading, removeFavorite } = useFavorites()
  const { setActivePageId, activePageId } = useNavigationStore()

  if (isLoading) return <PanelSkeleton />

  const pagesFavorites = favorites.filter((f) => f.page_id !== null)

  if (pagesFavorites.length === 0) return <EmptyPanel illustration="/illustrations/empty-favorites.png" text="즐겨찾기한 페이지가 없습니다" />

  return (
    <div className="p-1">
      {pagesFavorites.map((fav) => {
        const isActive = fav.page_id === activePageId
        return (
          <div
            key={fav.id}
            className={cn(
              'group flex items-center gap-2 px-2 py-3 rounded-md transition-colors duration-100',
              isActive
                ? 'bg-primary/[0.06] text-primary'
                : 'hover:bg-muted/70'
            )}
          >
            <button
              className="flex-1 flex items-center gap-2 text-[15px] text-left"
              onClick={() => { setActivePageId(fav.page_id!); onClose() }}
            >
              <NotebookPen className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary/70' : 'text-muted-foreground')} />
              <span className={cn('truncate', isActive ? 'font-medium' : 'text-foreground/75')}>{fav.title ?? '제목 없음'}</span>
            </button>
            <button
              onClick={() => removeFavorite(fav.id)}
              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-accent"
              title="즐겨찾기 해제"
            >
              <Minus className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function RecentContent({ onClose }: { onClose: () => void }) {
  const { recent, isLoading } = useRecentPages()
  const { setActivePageId, activePageId } = useNavigationStore()

  if (isLoading) return <PanelSkeleton />
  if (recent.length === 0) return <EmptyPanel illustration="/illustrations/empty-recent.png" text="최근 열람한 페이지가 없습니다" />

  return (
    <div className="p-1">
      {recent.map((page) => {
        const isActive = page.id === activePageId
        return (
          <button
            key={page.id}
            onClick={() => { setActivePageId(page.id); onClose() }}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors duration-100 text-left',
              isActive
                ? 'bg-primary/[0.06] text-primary'
                : 'hover:bg-muted/70'
            )}
          >
            <NotebookPen className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary/70' : 'text-muted-foreground')} />
            <span className={cn('flex-1 text-[15px] truncate min-w-0', isActive ? 'font-medium' : 'text-foreground/75')}>{page.title}</span>
            <span className="flex-shrink-0 text-[11px] text-muted-foreground/60 ml-1">
              {formatDistanceToNow(new Date(page.viewed_at), { addSuffix: true, locale: ko })}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function TrashItemIcon({ item }: { item: TrashItem }) {
  if (item.item_type !== 'notebook') {
    return <NotebookPen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
  }
  const iconPair = item.icon ? NOTEBOOK_ICON_MAP[item.icon] : null
  if (iconPair) {
    const Icon = iconPair.collapsed
    return (
      <Icon
        className="w-4 h-4 flex-shrink-0"
        style={item.color ? { color: item.color } : { color: 'var(--muted-foreground)' }}
      />
    )
  }
  return <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
}

function TrashContent() {
  const { items, isLoading, restore, deletePermanent, emptyTrash } = useTrash()

  if (isLoading) return <PanelSkeleton />
  if (items.length === 0) return <EmptyPanel illustration="/illustrations/empty-archive.png" text="아카이브가 비어 있습니다" />

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-1">
        {items.map((item) => (
          <div key={item.id} className="group flex items-center gap-2 px-2 py-3 rounded-md hover:bg-muted/70 transition-colors duration-100">
            <TrashItemIcon item={item} />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] truncate text-foreground/75">{item.title ?? '제목 없음'}</div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                onClick={() => { restore(item); toast.success('복원했습니다') }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent"
                title="복원"
              >
                <RotateCcw className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                onClick={() => { deletePermanent(item); toast.success('영구 삭제했습니다') }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10"
                title="영구 삭제"
              >
                <Trash className="w-3 h-3 text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* Empty-all footer */}
      <div className="flex-shrink-0 flex justify-end px-3 py-2 bg-sidebar-accent/60">
        <button
          onClick={() => { emptyTrash(); toast.success('아카이브를 비웠습니다') }}
          className="text-[11px] text-destructive/70 hover:text-destructive transition-colors"
        >
          아카이브 비우기
        </button>
      </div>
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="p-2 space-y-1.5">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  )
}

function EmptyPanel({ illustration, text }: { illustration: string; text: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      <img
        src={illustration}
        alt=""
        className="w-16 h-16 object-contain opacity-80"
        draggable={false}
      />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}
