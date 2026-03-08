import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'
import { Mathematics } from '@tiptap/extension-mathematics'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical } from 'lucide-react'
import 'katex/dist/katex.min.css'
import type { TextBox } from './DrawingCanvas'

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  box: TextBox
  isFocused: boolean
  isSelected: boolean
  tool: string
  pendingFocus: boolean
  onEditorReady: (editor: Editor) => void
  onFocus: () => void
  onBlur: (html: string, isEmpty: boolean) => void
  onHtmlChange: (html: string) => void
  onGripPointerDown: (e: React.PointerEvent, boxId: string) => void
  onPendingFocusResolved: () => void
  onBlockTypeChange: (t: TextBox['blockType']) => void
  onAlignChange: (a: 'left' | 'center' | 'right') => void
  onFormatChange: (f: { bold: boolean; italic: boolean; underline: boolean; strike: boolean }) => void
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TextBlockEditor({
  box, isFocused, isSelected, tool, pendingFocus,
  onEditorReady, onFocus, onBlur, onHtmlChange, onGripPointerDown,
  onPendingFocusResolved, onBlockTypeChange, onAlignChange, onFormatChange,
}: Props) {
  // 텍스트 블럭 호버 상태 (핸들 노출용)
  const [isHovered, setIsHovered] = useState(false)

  // 수식 입력창 표시 여부
  const [mathInputOpen, setMathInputOpen] = useState(false)
  const [mathFormula, setMathFormula] = useState('')
  const mathInputRef = useRef<HTMLInputElement>(null)

  // 수식 입력 중 TipTap blur 무시용 ref (stale closure 방지)
  const mathInputOpenRef = useRef(false)
  mathInputOpenRef.current = mathInputOpen

  // 수식 수정 모드: 클릭된 기존 노드의 ProseMirror 위치 (null = 신규 삽입)
  const editingMathPosRef = useRef<number | null>(null)

  // ── Bug 2 fix: 수식 패널 DOM 참조 (blur 시 패널 내부 클릭 판별용) ──────────
  // useEditor 클로저에서 읽으므로 반드시 useEditor 호출 전에 선언해야 함
  const mathPanelRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      // inlineOptions.onClick: 수식 클릭 시 수정 모드로 입력창 열기
      // setMathFormula / setMathInputOpen 은 안정적인 React setter → stale closure 없음
      Mathematics.configure({
        inlineOptions: {
          onClick: (node: unknown, pos: number) => {
            const mathNode = node as { attrs: { latex: string } }
            editingMathPosRef.current = pos
            setMathFormula(mathNode.attrs.latex || '')
            setMathInputOpen(true)
          },
        },
      }),
    ],
    content: box.html || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
        autocomplete: 'off',
      },
    },

    onUpdate: ({ editor }) => {
      onHtmlChange(editor.getHTML())
      // 블록 타입 감지 (onUpdate에서도 처리 — setHeading/setParagraph 후 onSelectionUpdate가 안 올 수 있음)
      const bt: TextBox['blockType'] =
        editor.isActive('heading', { level: 1 }) ? 'h1' :
        editor.isActive('heading', { level: 2 }) ? 'h2' :
        editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
      onBlockTypeChange(bt)
      // 정렬 감지 (setTextAlign 후 onSelectionUpdate가 안 올 수 있음)
      const al: 'left' | 'center' | 'right' =
        editor.isActive({ textAlign: 'center' }) ? 'center' :
        editor.isActive({ textAlign: 'right' })  ? 'right' : 'left'
      onAlignChange(al)
      // 서식 감지 (stored marks 변경 시 onUpdate 안 옴 — onClick에서 직접 동기화하므로 여기선 선택 텍스트 케이스 보강)
      onFormatChange({
        bold:      editor.isActive('bold'),
        italic:    editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike:    editor.isActive('strike'),
      })
    },
    onFocus: ({ editor }) => {
      onEditorReady(editor as unknown as Editor)
      onFocus()
    },
    // ── Bug 2 fix: 포커스가 수식 패널 내부로 이동하면 무시
    //              외부로 이동하면 수식 닫기 + 부모에게 blur 전달
    onBlur: ({ editor, event }) => {
      const relatedTarget = (event as FocusEvent | undefined)?.relatedTarget as HTMLElement | null
      // 수식 패널(input / 버튼) 쪽으로 포커스가 이동한 경우 → 아무것도 하지 않음
      if (relatedTarget && mathPanelRef.current?.contains(relatedTarget)) return
      // 수식 입력창이 열려 있었으면 닫기
      if (mathInputOpenRef.current) {
        editingMathPosRef.current = null
        setMathInputOpen(false)
        setMathFormula('')
      }
      onBlur(editor.getHTML(), editor.isEmpty)
    },
    onSelectionUpdate: ({ editor }) => {
      // 블록 타입 감지
      const bt: TextBox['blockType'] =
        editor.isActive('heading', { level: 1 }) ? 'h1' :
        editor.isActive('heading', { level: 2 }) ? 'h2' :
        editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
      onBlockTypeChange(bt)
      // 정렬 감지
      const al: 'left' | 'center' | 'right' =
        editor.isActive({ textAlign: 'center' }) ? 'center' :
        editor.isActive({ textAlign: 'right' })  ? 'right' : 'left'
      onAlignChange(al)
      // 서식 감지 (bold / italic / underline / strike)
      onFormatChange({
        bold:      editor.isActive('bold'),
        italic:    editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike:    editor.isActive('strike'),
      })
    },
  })

  // ── Bug 1 fix: 신규 박스 자동 포커스 — chain()으로 단일 트랜잭션 처리 ───────
  // 개별 commands.xxx() 호출 시 onUpdate가 각각 발생해 중간 상태가 동기화되는
  // 문제를 chain()으로 묶어 한 번에 처리
  useEffect(() => {
    if (!pendingFocus || !editor) return
    const t = setTimeout(() => {
      const chain = editor.chain()
      if (box.blockType === 'h1')      chain.setHeading({ level: 1 })
      else if (box.blockType === 'h2') chain.setHeading({ level: 2 })
      else if (box.blockType === 'h3') chain.setHeading({ level: 3 })
      chain.setTextAlign(box.align).focus('end').run()
      onPendingFocusResolved()
    }, 10)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocus, editor])

  // ── 외부 html 동기화 (포커스 중엔 스킵) ──────────────────────────────────
  useEffect(() => {
    if (!editor || editor.isFocused) return
    const current = editor.getHTML()
    if (current !== box.html && box.html) {
      editor.commands.setContent(box.html, { emitUpdate: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.html])

  // ── Bug 3 fix: isFocused 해제 시 hover 잔상 제거 ─────────────────────────
  useEffect(() => {
    if (!isFocused) setIsHovered(false)
  }, [isFocused])

  // ── 수식 삽입 / 수정 ──────────────────────────────────────────────────────
  const insertMath = () => {
    const formula = mathFormula.trim()
    if (!formula || !editor) return

    const editPos = editingMathPosRef.current
    editingMathPosRef.current = null

    if (editPos !== null) {
      // 기존 inlineMath 노드를 새 수식으로 교체
      editor.chain().focus().command(({ tr, state }) => {
        const node = state.doc.nodeAt(editPos)
        if (!node || node.type.name !== 'inlineMath') return false
        const newNode = state.schema.nodes['inlineMath'].create({ latex: formula })
        tr.replaceWith(editPos, editPos + node.nodeSize, newNode)
        return true
      }).run()
    } else {
      // 신규 inlineMath 노드 삽입
      editor.chain().focus().insertContent({
        type: 'inlineMath',
        attrs: { latex: formula },
      }).run()
    }

    setMathFormula('')
    setMathInputOpen(false)
  }

  // ── 수식 입력 취소 ────────────────────────────────────────────────────────
  const cancelMath = () => {
    editingMathPosRef.current = null
    setMathInputOpen(false)
    setMathFormula('')
    editor?.commands.focus()
  }

  // 수식 입력창 열릴 때 자동 포커스
  useEffect(() => {
    if (mathInputOpen) {
      setTimeout(() => mathInputRef.current?.focus(), 50)
    }
  }, [mathInputOpen])

  // ── 테두리 색상 ──────────────────────────────────────────────────────────
  const border = isFocused
    ? '2px dashed rgba(99,102,241,0.72)'
    : isHovered
    ? '2px dashed rgba(99,102,241,0.30)'
    : '2px dashed transparent'

  const inActiveMode = tool === 'text' || tool === 'select'

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'absolute', left: box.x, top: box.y, pointerEvents: 'auto' }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── 드래그 핸들 (텍스트 · 선택 모드에서 항상 표시) ── */}
      {inActiveMode && (
        <div
          style={{
            position: 'absolute',
            left: -24,
            top: 2,
            width: 20,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            opacity: isFocused || isSelected ? 0.60 : isHovered ? 0.55 : 0,
            transition: 'opacity 0.15s',
            zIndex: 10,
            touchAction: 'none',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.85' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = isFocused || isSelected ? '0.60' : isHovered ? '0.55' : '0' }}
          title="드래그: 이동 / 클릭: 선택"
          onPointerDown={(e) => {
            e.stopPropagation()
            onGripPointerDown(e, box.id)
          }}
        >
          <GripVertical style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
        </div>
      )}

      {/* ── TipTap 에디터 (width hug) ── */}
      <div
        className="tbe-wrap"
        style={{
          display: 'inline-block',
          width: 'max-content',
          minWidth: 200,
          maxWidth: 640,
          border,
          borderRadius: 5,
          padding: '4px 8px',
          boxSizing: 'border-box',
          verticalAlign: 'top',
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* ── 수식 버튼 (포커스 시 하단, 수식 입력 중에는 포커스 없어도 유지) ── */}
      <AnimatePresence>
        {(isFocused || mathInputOpen) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.12 }}
            style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50 }}
          >
            {mathInputOpen ? (
              /* 수식 입력창 — ref 부착으로 blur 시 패널 내부 판별 가능 */
              <div
                ref={mathPanelRef}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-background/98 backdrop-blur-sm border border-border rounded-xl shadow-lg pointer-events-auto whitespace-nowrap"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <span className="text-xs text-blue-500 font-semibold font-mono select-none">$</span>
                <input
                  ref={mathInputRef}
                  type="text"
                  value={mathFormula}
                  onChange={(e) => setMathFormula(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); insertMath() }
                    if (e.key === 'Escape') cancelMath()
                  }}
                  placeholder="E=mc^2"
                  className="text-xs font-mono bg-transparent outline-none text-foreground w-36 placeholder:text-muted-foreground/40"
                />
                <span className="text-xs text-blue-500 font-semibold font-mono select-none">$</span>
                <button
                  onClick={insertMath}
                  className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors whitespace-nowrap flex-shrink-0"
                >{editingMathPosRef.current !== null ? '수정' : '삽입'}</button>
                <button
                  onClick={cancelMath}
                  className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors flex-shrink-0"
                >✕</button>
              </div>
            ) : (
              /* 수식 버튼 */
              <button
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground/60 hover:text-foreground bg-background/80 border border-border/50 rounded-lg shadow-sm transition-colors pointer-events-auto"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMathInputOpen(true)}
                title="수식 입력 (LaTeX)"
              >
                <span className="font-serif italic text-sm leading-none">∑</span>
                <span>수식</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
