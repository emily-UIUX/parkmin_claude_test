import { useEffect, useRef, useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { AUTOSAVE_DELAY } from '@/lib/constants'

export function useAutoSave(
  pageId: string | null,
  saveFn: (pageId: string, data: { content: Record<string, unknown>; plain_text_content: string; title: string }) => Promise<void>
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { setSaveStatus } = useEditorStore()

  const save = useCallback(
    (data: { content: Record<string, unknown>; plain_text_content: string; title: string }) => {
      if (!pageId) return

      if (timerRef.current) clearTimeout(timerRef.current)
      setSaveStatus('saving')

      timerRef.current = setTimeout(async () => {
        try {
          await saveFn(pageId, data)
          setSaveStatus('saved')
        } catch {
          setSaveStatus('error')
        }
      }, AUTOSAVE_DELAY)
    },
    [pageId, saveFn, setSaveStatus]
  )

  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { save, flushSave }
}
