import { Star, FileText, Folder, X } from 'lucide-react'
import { useFavorites } from '@/hooks/useFavorites'
import { useNavigationStore } from '@/stores/navigationStore'
import { SidebarSection } from './SidebarSection'
import { Skeleton } from '@/components/ui/skeleton'

export function FavoritesSection() {
  const { favorites, isLoading, removeFavorite } = useFavorites()
  const { setActivePageId } = useNavigationStore()

  return (
    <SidebarSection
      title="즐겨찾기"
      icon={Star}
      iconColor="text-yellow-500"
      count={favorites.length || undefined}
      storageKey="favorites"
      defaultOpen={true}
    >
      {isLoading ? (
        <SectionSkeleton />
      ) : favorites.length === 0 ? (
        <SectionEmpty text="즐겨찾기가 없습니다" />
      ) : (
        <div className="pb-1 px-1">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
            >
              <button
                className="flex-1 flex items-center gap-2 text-left min-w-0"
                onClick={() => { if (fav.page_id) setActivePageId(fav.page_id) }}
              >
                {fav.type === 'notebook'
                  ? <Folder className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  : <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                }
                <span className="truncate text-sm text-foreground/80">{fav.title ?? '제목 없음'}</span>
              </button>
              <button
                onClick={() => removeFavorite(fav.id)}
                className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-accent flex-shrink-0"
                title="즐겨찾기 제거"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </SidebarSection>
  )
}

function SectionSkeleton() {
  return (
    <div className="p-2 space-y-1.5">
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-7 rounded-md" />
      ))}
    </div>
  )
}

function SectionEmpty({ text }: { text: string }) {
  return (
    <div className="py-4 px-3 text-center">
      <p className="text-xs text-muted-foreground/60">{text}</p>
    </div>
  )
}
