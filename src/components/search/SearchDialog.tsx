import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, FileText, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useUIStore } from '@/stores/uiStore'
import { useNavigationStore } from '@/stores/navigationStore'
import { supabase } from '@/lib/supabase'

interface SearchResult {
  id: string
  title: string
  plain_text_content: string
  updated_at: string
  notebook_title?: string
}

export function SearchDialog() {
  const { isSearchOpen, setSearchOpen } = useUIStore()
  const { setActivePageId } = useNavigationStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setIsSearching(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data } = await supabase
        .from('pages')
        .select('id, title, plain_text_content, updated_at')
        .eq('is_deleted', false)
        .or(`title.ilike.%${q}%,plain_text_content.ilike.%${q}%`)
        .limit(20)

      setResults((data as SearchResult[]) || [])
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    if (!isSearchOpen) {
      setQuery('')
      setResults([])
    }
  }, [isSearchOpen])

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen])

  const handleSelect = (page: SearchResult) => {
    setActivePageId(page.id)
    setSearchOpen(false)
  }

  const highlight = (text: string, q: string) => {
    if (!q.trim()) return text
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">{part}</mark> : part
    )
  }

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setSearchOpen(false)}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />
              ) : (
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <Input
                autoFocus
                placeholder="페이지 제목이나 내용 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border-none bg-transparent p-0 h-auto text-base focus-visible:ring-0 shadow-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent flex-shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {results.length === 0 && query.trim() && !isSearching && (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>"{query}"에 대한 결과 없음</p>
                </div>
              )}
              {results.length === 0 && !query.trim() && (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <p>검색어를 입력하세요</p>
                </div>
              )}
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {highlight(result.title, query)}
                    </div>
                    {result.plain_text_content && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {highlight(result.plain_text_content.slice(0, 120), query)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center gap-4 text-xs text-muted-foreground">
              <span><kbd className="bg-background border border-border px-1 rounded">↑↓</kbd> 탐색</span>
              <span><kbd className="bg-background border border-border px-1 rounded">↵</kbd> 열기</span>
              <span><kbd className="bg-background border border-border px-1 rounded">Esc</kbd> 닫기</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
