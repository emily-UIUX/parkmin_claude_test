import { useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelLeft } from 'lucide-react'
import { TreeSidebar } from '@/components/sidebar/TreeSidebar'
import { NoteEditor } from '@/components/editor/NoteEditor'
import { SearchDialog } from '@/components/search/SearchDialog'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useUIStore } from '@/stores/uiStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { useSidebarSwipe } from '@/hooks/useTouchGestures'
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '@/lib/constants'

export function AppShell() {
  const { isSidebarOpen, sidebarWidth, setSidebarWidth, setSidebarOpen } = useUIStore()
  const { activePageId } = useNavigationStore()
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)
  const { onTouchStart, onTouchEnd } = useSidebarSwipe()

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = sidebarWidth

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const delta = ev.clientX - startX.current
      const newWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, startWidth.current + delta)
      )
      setSidebarWidth(newWidth)
    }

    const onMouseUp = () => {
      isResizing.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [sidebarWidth, setSidebarWidth])

  return (
    <div
      className="flex h-dvh overflow-hidden bg-background app-shell"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Sidebar */}
      <motion.div
        className="flex-shrink-0 h-full overflow-hidden"
        initial={false}
        animate={{
          width: isSidebarOpen ? sidebarWidth : 0,
          opacity: isSidebarOpen ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div style={{ width: sidebarWidth }} className="h-full">
          <TreeSidebar />
        </div>
      </motion.div>

      {/* Resize handle (desktop only) */}
      {isSidebarOpen && (
        <div
          className="w-1 flex-shrink-0 h-full cursor-col-resize hover:bg-primary/20 transition-colors relative hidden tablet:block"
          onMouseDown={onResizeStart}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 h-full overflow-hidden relative">
        {/* Mobile sidebar toggle button (visible when sidebar closed) */}
        <AnimatePresence>
          {!isSidebarOpen && (
            <motion.button
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center
                         rounded-md bg-background border border-border shadow-sm hover:bg-accent transition-colors"
              onClick={() => setSidebarOpen(true)}
              title="사이드바 열기"
            >
              <PanelLeft className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>

        {activePageId ? (
          <ErrorBoundary key={activePageId}>
            <NoteEditor pageId={activePageId} />
          </ErrorBoundary>
        ) : (
          <EmptyEditorState onOpenSidebar={() => setSidebarOpen(true)} />
        )}
      </div>

      <SearchDialog />
    </div>
  )
}

function EmptyEditorState({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { isSidebarOpen } = useUIStore()
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground select-none px-6">
      <div className="text-6xl mb-4">📝</div>
      <h2 className="text-xl font-medium text-foreground mb-2 text-center">페이지를 선택하세요</h2>
      <p className="text-sm text-center mb-4">
        {isSidebarOpen
          ? '왼쪽 트리에서 페이지를 선택하거나 새 페이지를 만들어 시작하세요.'
          : '사이드바를 열어 노트북과 페이지를 관리하세요.'}
      </p>
      {!isSidebarOpen && (
        <button
          onClick={onOpenSidebar}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
          사이드바 열기
        </button>
      )}
    </div>
  )
}
