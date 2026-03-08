import { useEffect, useState, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { Folder, CalendarDays, Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useEditorStore } from '@/stores/editorStore'
import { useRecentPages } from '@/hooks/useRecentPages'
import { useTreeStore } from '@/stores/treeStore'
import { getAncestors } from '@/lib/tree-utils'
import { SaveIndicator } from './SaveIndicator'
import { DrawingCanvas } from './DrawingCanvas'
import type { DrawingData } from './DrawingCanvas'
import type { Page } from '@/types'
import type { ComponentType } from 'react'

interface NoteEditorProps {
  pageId: string
}

// 수정 경과 시간 계산
function getTimeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1)  return '방금'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24)    return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function NoteEditor({ pageId }: NoteEditorProps) {
  const [page, setPage] = useState<Page | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [isTitleFocused, setIsTitleFocused] = useState(false)
  const titleRef = useRef(title)
  const { setPageTitle } = useEditorStore()
  const { trackPage } = useRecentPages()

  useEffect(() => { titleRef.current = title }, [title])

  // Load page
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setPage(null)
    void Promise.resolve(
      supabase.from('pages').select('*').eq('id', pageId).single()
    ).then(({ data }) => {
      if (cancelled) return
      if (data) {
        setPage(data as Page)
        setTitle(data.title)
        setPageTitle(data.title)
        trackPage(pageId)
      }
      setIsLoading(false)
    }).catch(() => { if (!cancelled) setIsLoading(false) })  // 네트워크 에러 시 스피너 무한 방지
    return () => { cancelled = true }
  }, [pageId, setPageTitle])

  const savePage = useCallback(
    async (id: string, data: { content: Record<string, unknown>; plain_text_content: string; title: string }) => {
      await supabase
        .from('pages')
        .update({
          content: data.content,
          plain_text_content: data.plain_text_content,
          title: data.title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    },
    []
  )

  const { save } = useAutoSave(pageId, savePage)

  useEffect(() => {
    if (!page || isLoading) return
    const contentType = (page.content as Record<string, unknown>)?.type
    if (contentType !== 'drawing') {
      const drawingContent: DrawingData = { type: 'drawing', strokes: [], version: 1 }
      save({ content: drawingContent as unknown as Record<string, unknown>, plain_text_content: '', title: page.title })
      setPage((prev) => prev ? { ...prev, content: drawingContent as unknown as Record<string, unknown> } : prev)
    } else {
      const drawData = page.content as unknown as DrawingData
      const plainText = (drawData?.textBoxes ?? []).map(tb => tb.html).filter(Boolean).join(' ')
      if (plainText) {
        save({ content: page.content as Record<string, unknown>, plain_text_content: plainText, title: page.title })
      }
    }
  }, [page?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    setPageTitle(newTitle)
    const drawData = page?.content as unknown as DrawingData | undefined
    const plainText = (drawData?.textBoxes ?? []).map(tb => tb.html).filter(Boolean).join(' ')
    save({ content: (page?.content || {}) as Record<string, unknown>, plain_text_content: plainText, title: newTitle })
  }

  const handleDrawingChange = useCallback((data: DrawingData) => {
    const plainText = (data.textBoxes ?? []).map(tb => tb.html).filter(Boolean).join(' ')
    save({ content: data as unknown as Record<string, unknown>, plain_text_content: plainText, title: titleRef.current })
    setPage((prev) => prev ? { ...prev, updated_at: new Date().toISOString() } : prev)
  }, [save])

  // ── Meta ──
  const tree = useTreeStore((s) => s.tree)
  const ancestors = getAncestors(tree, pageId)
  const parentLabel = (() => {
    if (ancestors.length === 0) return null
    if (ancestors.length === 1) return ancestors[0].title
    if (ancestors.length === 2) return `${ancestors[0].title} / ${ancestors[1].title}`
    return `${ancestors[0].title} / ... / ${ancestors[ancestors.length - 1].title}`
  })()

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        페이지를 찾을 수 없습니다.
      </div>
    )
  }

  const contentType = (page.content as Record<string, unknown>)?.type
  const drawingData: DrawingData | undefined = contentType === 'drawing'
    ? (page.content as unknown as DrawingData)
    : undefined

  const dateLabel    = page.updated_at ? format(new Date(page.updated_at), 'yy.MM.dd HH:mm') : null
  const timeAgoLabel = page.updated_at ? getTimeAgo(page.updated_at) : null

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col flex-shrink-0 pl-10 pr-8 pt-6 pb-4 border-b border-border/20 gap-3 items-start">

        {/* Title + Save indicator */}
        <div className="flex items-baseline w-full">
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onFocus={() => setIsTitleFocused(true)}
            onBlur={() => setIsTitleFocused(false)}
            placeholder="제목 없음"
            className={cn(
              'w-full max-w-[320px] min-w-0 text-[28px] font-bold leading-tight outline-none text-foreground',
              'placeholder:text-muted-foreground/30 px-2 py-0.5 rounded-lg -mx-2',
              'transition-all duration-150',
              isTitleFocused
                ? 'bg-muted/40 ring-1 ring-border/60'
                : 'bg-transparent hover:bg-muted/25'
            )}
          />
          <div className="ml-auto"><SaveIndicator /></div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-1.5 flex-wrap -ml-2">
          {parentLabel && (
            <GhostBorderChip icon={Folder} label={parentLabel} />
          )}
          {(dateLabel || timeAgoLabel) && parentLabel && (
            <span className="text-border/60 text-xs select-none">·</span>
          )}
          {dateLabel && (
            <GhostChip icon={CalendarDays} label={dateLabel} />
          )}
          {timeAgoLabel && (
            <span className="ml-1"><GhostChip icon={Clock} label={timeAgoLabel} /></span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden relative">
        <DrawingCanvas
          key={pageId}
          initialData={drawingData}
          onChange={handleDrawingChange}
        />
      </div>
    </div>
  )
}

// ── Chips ──

interface ChipProps {
  icon: ComponentType<{ className?: string }>
  label: string
}

/** 테두리 ghost 스타일 (폴더) */
function GhostBorderChip({ icon: Icon, label }: ChipProps) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground select-none pointer-events-none">
      <Icon className="w-3 h-3 opacity-60 flex-shrink-0" />
      <span className="truncate max-w-[240px]">{label}</span>
    </div>
  )
}

/** 배경 없는 ghost 스타일 (날짜, 시간) */
function GhostChip({ icon: Icon, label }: ChipProps) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground/60 select-none pointer-events-none">
      <Icon className="w-3 h-3 opacity-50 flex-shrink-0" />
      <span>{label}</span>
    </div>
  )
}
