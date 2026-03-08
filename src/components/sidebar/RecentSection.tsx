import { Clock, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useRecentPages } from '@/hooks/useRecentPages'
import { useNavigationStore } from '@/stores/navigationStore'
import { SidebarSection } from './SidebarSection'
import { Skeleton } from '@/components/ui/skeleton'

export function RecentSection() {
  const { recent, isLoading } = useRecentPages()
  const { setActivePageId } = useNavigationStore()

  return (
    <SidebarSection
      title="최근 항목"
      icon={Clock}
      iconColor="text-blue-500"
      count={recent.length || undefined}
      storageKey="recent"
      defaultOpen={false}
    >
      {isLoading ? (
        <SectionSkeleton />
      ) : recent.length === 0 ? (
        <SectionEmpty text="최근 열람한 페이지가 없습니다" />
      ) : (
        <div className="pb-1 px-1">
          {recent.map((page) => (
            <button
              key={page.id}
              onClick={() => setActivePageId(page.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors text-left"
            >
              <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate text-foreground/80">{page.title}</div>
                <div className="text-[11px] text-muted-foreground/60">
                  {formatDistanceToNow(new Date(page.viewed_at), { addSuffix: true, locale: ko })}
                </div>
              </div>
            </button>
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
        <Skeleton key={i} className="h-8 rounded-md" />
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
