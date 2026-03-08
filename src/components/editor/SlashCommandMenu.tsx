import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Editor } from '@tiptap/react'

interface SlashCommand {
  id: string
  icon: string
  label: string
  description: string
  action: (editor: Editor) => void
}

const COMMANDS: SlashCommand[] = [
  {
    id: 'h1', icon: 'H1', label: '제목 1', description: '큰 제목',
    action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2', icon: 'H2', label: '제목 2', description: '중간 제목',
    action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3', icon: 'H3', label: '제목 3', description: '작은 제목',
    action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet', icon: '•', label: '불릿 리스트', description: '정렬되지 않은 목록',
    action: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ordered', icon: '1.', label: '번호 리스트', description: '순서가 있는 목록',
    action: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'todo', icon: '☐', label: '체크리스트', description: '할 일 목록',
    action: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'quote', icon: '❝', label: '인용문', description: '인용 블록',
    action: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'code', icon: '<>', label: '코드 블록', description: '코드 작성',
    action: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'table', icon: '⊞', label: '표', description: '3×3 표 삽입',
    action: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'divider', icon: '—', label: '구분선', description: '가로 구분선',
    action: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'date', icon: '📅', label: '날짜', description: '오늘 날짜 삽입',
    action: (e) => {
      const today = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
      })
      e.chain().focus().insertContent(today).run()
    },
  },
]

interface SlashCommandMenuProps {
  editor: Editor
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = COMMANDS.filter(
    (c) => !query || c.label.includes(query) || c.description.includes(query) || c.id.includes(query.toLowerCase())
  )

  const executeCommand = useCallback((cmd: SlashCommand) => {
    // Delete the "/query" text
    const { from } = editor.state.selection
    const text = editor.state.doc.textBetween(Math.max(0, from - query.length - 1), from, '')
    if (text.startsWith('/')) {
      editor.chain().focus().deleteRange({ from: from - query.length - 1, to: from }).run()
    }
    cmd.action(editor)
    setOpen(false)
    setQuery('')
  }, [editor, query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)) }
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[selectedIdx]) executeCommand(filtered[selectedIdx]) }
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, selectedIdx, filtered, executeCommand])

  useEffect(() => {
    const handleUpdate = () => {
      const { from } = editor.state.selection
      const text = editor.state.doc.textBetween(
        Math.max(0, from - 20), from, ''
      )
      const slashIdx = text.lastIndexOf('/')
      if (slashIdx !== -1 && slashIdx === text.length - 1 - (text.length - slashIdx - 1)) {
        const q = text.slice(slashIdx + 1)
        if (!q.includes(' ') && slashIdx >= 0) {
          setQuery(q)
          setSelectedIdx(0)

          // Position near cursor
          const coords = editor.view.coordsAtPos(from)
          const editorEl = editor.view.dom.getBoundingClientRect()
          setPosition({
            top: coords.bottom - editorEl.top + 4,
            left: coords.left - editorEl.left,
          })
          setOpen(true)
          return
        }
      }
      setOpen(false)
    }

    editor.on('transaction', handleUpdate)
    return () => { editor.off('transaction', handleUpdate) }
  }, [editor])

  if (!open || filtered.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.1 }}
        className="absolute z-50 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        style={{ top: position.top, left: position.left }}
      >
        <div className="p-1 max-h-72 overflow-y-auto">
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={() => executeCommand(cmd)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left
                ${i === selectedIdx ? 'bg-accent' : 'hover:bg-accent/50'}`}
            >
              <span className="w-7 h-7 flex items-center justify-center rounded bg-muted text-xs font-bold flex-shrink-0">
                {cmd.icon}
              </span>
              <div>
                <div className="font-medium">{cmd.label}</div>
                <div className="text-xs text-muted-foreground">{cmd.description}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-[11px] text-muted-foreground">
          ↑↓ 탐색 &nbsp;·&nbsp; ↵ 실행 &nbsp;·&nbsp; Esc 닫기
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
