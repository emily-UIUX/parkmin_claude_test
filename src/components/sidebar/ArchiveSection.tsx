import { Archive, FileText, Folder, RotateCcw, Trash } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'
import { useTrash } from '@/hooks/useTrash'
import { SidebarSection } from './SidebarSection'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function ArchiveSection() {
  const { items, isLoading, restore, deletePermanent, emptyTrash } = useTrash()

  const emptyAction = items.length > 0 ? (
    <Button
      size="sm"
      variant="ghost"
      className="h-5 text-[10px] px-1.5 text-destructive hover:text-destructive"
      onClick={() => { emptyTrash(); toast.success('아카이브를 비웠습니다') }}
    >
      모두 삭제
    </Button>
  ) : undefined

  return (
    <SidebarSection
      title="아카이브"
      icon={Archive}
      iconColor="text-muted-foreground"
      count={items.length || undefined}
      actions={emptyAction}
      storageKey="archive"
      defaultOpen={false}
    >
      {isLoading ? (
        <SectionSkeleton />
      ) : items.length === 0 ? (
        <SectionEmpty text="아카이브가 비어 있습니다" />
      ) : (
        <div className="pb-1 px-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
            >
              {item.item_type === 'notebook'
                ? <Folder className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                : <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate text-foreground/70">{item.title ?? '제목 없음'}</div>
                <div className="text-[11px] text-muted-foreground/50">
                  {format(new Date(item.deleted_at), 'M월 d일', { locale: ko })} 삭제됨
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0">
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
