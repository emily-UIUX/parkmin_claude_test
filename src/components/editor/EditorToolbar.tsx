import { useEffect, useState, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, Link2,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListTodo,
  Code, Image,
  Undo2, Redo2,
  IndentIncrease, IndentDecrease,
  Check, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [hasSelection, setHasSelection] = useState(false)
  const [isLinkMode, setIsLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editor) return
    const update = () => {
      setHasSelection(!editor.state.selection.empty)
      // Close link mode if selection changes
      setIsLinkMode(false)
    }
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  if (!editor) return null

  const ToolBtn = ({
    icon: Icon,
    onClick,
    active = false,
    title,
    disabled = false,
  }: {
    icon: React.ComponentType<{ className?: string }>
    onClick: () => void
    active?: boolean
    title: string
    disabled?: boolean
  }) => (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-foreground/70 hover:text-foreground hover:bg-muted/80',
        disabled && 'opacity-30 cursor-default'
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  )

  const Sep = () => <div className="w-px h-5 bg-border/70 mx-0.5 flex-shrink-0" />

  // ── Link helpers ─────────────────────────────────────────────────────────
  const openLinkMode = () => {
    setLinkUrl(editor.getAttributes('link').href ?? '')
    setIsLinkMode(true)
    setTimeout(() => linkInputRef.current?.focus(), 30)
  }

  const applyLink = () => {
    const url = linkUrl.trim()
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setIsLinkMode(false)
    setLinkUrl('')
  }

  const cancelLink = () => {
    setIsLinkMode(false)
    setLinkUrl('')
  }

  // ── Image file picker ────────────────────────────────────────────────────
  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(editor.chain().focus() as any).setImage({ src: reader.result as string }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      {/* Hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />

      <div
        className={cn(
          'pointer-events-auto flex items-center gap-0.5 px-2 py-1.5',
          'bg-background/95 backdrop-blur-sm border border-border rounded-full shadow-lg',
          'transition-all duration-150'
        )}
      >
        {/* ── Link URL input mode ── */}
        {isLinkMode ? (
          <>
            <button
              onClick={cancelLink}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              title="취소"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <input
              ref={linkInputRef}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                if (e.key === 'Escape') cancelLink()
              }}
              placeholder="URL 입력 (https://...)"
              className="w-56 h-7 px-2 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            />
            <button
              onClick={applyLink}
              className="w-7 h-7 flex items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors"
              title="적용"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </>
        ) : hasSelection ? (
          /* ── Text selection mode: character formatting ── */
          <>
            <ToolBtn icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게 (⌘B)" />
            <ToolBtn icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임 (⌘I)" />
            <ToolBtn icon={Underline} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄 (⌘U)" />
            <ToolBtn icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="취소선" />
            <Sep />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <ToolBtn icon={Highlighter} onClick={() => (editor.chain().focus() as any).toggleHighlight().run()} active={editor.isActive('highlight')} title="형광펜" />
            <ToolBtn icon={Code} onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="인라인 코드" />
            <Sep />
            <ToolBtn
              icon={Link2}
              onClick={openLinkMode}
              active={editor.isActive('link')}
              title="링크 (⌘K)"
            />
            <Sep />
            <ToolBtn icon={Undo2} onClick={() => editor.chain().focus().undo().run()} title="실행 취소 (⌘Z)" disabled={!editor.can().undo()} />
            <ToolBtn icon={Redo2} onClick={() => editor.chain().focus().redo().run()} title="다시 실행 (⌘Y)" disabled={!editor.can().redo()} />
          </>
        ) : (
          /* ── Default mode: paragraph/block formatting ── */
          <>
            <ToolBtn icon={Heading1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="제목 1" />
            <ToolBtn icon={Heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목 2" />
            <ToolBtn icon={Heading3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목 3" />
            <Sep />
            <ToolBtn icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게 (⌘B)" />
            <ToolBtn icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임 (⌘I)" />
            <Sep />
            <ToolBtn icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="불릿 리스트" />
            <ToolBtn icon={ListOrdered} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 리스트" />
            <ToolBtn icon={ListTodo} onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="체크리스트" />
            <Sep />
            <ToolBtn
              icon={IndentIncrease}
              onClick={() => {
                if (editor.can().sinkListItem('listItem')) editor.chain().focus().sinkListItem('listItem').run()
                else if (editor.can().sinkListItem('taskItem')) editor.chain().focus().sinkListItem('taskItem').run()
              }}
              title="들여쓰기"
              disabled={!editor.can().sinkListItem('listItem') && !editor.can().sinkListItem('taskItem')}
            />
            <ToolBtn
              icon={IndentDecrease}
              onClick={() => {
                if (editor.can().liftListItem('listItem')) editor.chain().focus().liftListItem('listItem').run()
                else if (editor.can().liftListItem('taskItem')) editor.chain().focus().liftListItem('taskItem').run()
              }}
              title="내어쓰기"
              disabled={!editor.can().liftListItem('listItem') && !editor.can().liftListItem('taskItem')}
            />
            <Sep />
            <ToolBtn
              icon={Image}
              onClick={() => imageInputRef.current?.click()}
              title="이미지 첨부"
            />
            <Sep />
            <ToolBtn icon={Undo2} onClick={() => editor.chain().focus().undo().run()} title="실행 취소 (⌘Z)" disabled={!editor.can().undo()} />
            <ToolBtn icon={Redo2} onClick={() => editor.chain().focus().redo().run()} title="다시 실행 (⌘Y)" disabled={!editor.can().redo()} />
          </>
        )}
      </div>
    </div>
  )
}
