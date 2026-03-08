import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pen, Highlighter, Eraser, Type, ImagePlus,
  ZoomIn, ZoomOut, Maximize2,
  SquareDashedMousePointer, Shapes,
  StickyNote as StickyNoteIcon,
  AlignLeft, AlignCenter, AlignRight,
  RotateCcw, RotateCw,
  // 선택 모드
  BoxSelect, Lasso,
  // 도형 타입
  Circle, Square, Star, Minus,
  // 이미지
  ImageIcon, Crop, X as XIcon,
  // 텍스트 서식
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
} from 'lucide-react'
import type { Editor } from '@tiptap/core'
import { cn } from '@/lib/utils'
import { TextBlockEditor } from './TextBlockEditor'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number; pressure: number }

interface Stroke {
  id: string
  color: string
  width: number
  opacity: number
  points: Point[]
  tool: 'pen' | 'highlighter' | 'eraser'
  isShape?: boolean   // 도형 stroke — lineTo 렌더링 사용
}

export interface TextBox {
  id: string; x: number; y: number; width: number
  html: string                                      // rich HTML (contenteditable)
  blockType: 'p' | 'h1' | 'h2' | 'h3'             // 블록 타입 (마크다운 지원)
  fontSize: number                                   // p 타입 전용 (heading은 고정)
  align: 'left' | 'center' | 'right'
}

export interface CanvasImage {
  id: string; x: number; y: number; width: number; height: number; src: string
}

export interface StickyNote {
  id: string; x: number; y: number; width: number; height: number
  text: string; bgColor: string; fontSize: number
}

export interface DrawingData {
  type: 'drawing'
  strokes: Stroke[]
  textBoxes?: TextBox[]
  images?: CanvasImage[]
  stickyNotes?: StickyNote[]
  version: 1
}

interface DrawingCanvasProps {
  initialData?: DrawingData
  onChange: (data: DrawingData) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

// 펜 색상 3컬러 (라이트/다크)
const PEN_COLORS_LIGHT  = ['#1a1a1a', '#dc2626', '#1d4ed8'] as const  // 검정·빨강·파랑
const PEN_COLORS_DARK   = ['#e5e7eb', '#f87171', '#60a5fa'] as const  // 밝은 버전

// 형광펜 색상 3컬러 – 고명채도 (라이트/다크)
const HL_COLORS_LIGHT   = ['#f43f5e', '#eab308', '#0ea5e9'] as const  // 핑크·노랑·하늘
const HL_COLORS_DARK    = ['#fb7185', '#fde047', '#38bdf8'] as const  // 밝은 버전

// 포스트잇 배경색 6컬러 (라이트/다크)
const STICKY_COLORS_LIGHT = ['#fef08a', '#fda4af', '#86efac', '#93c5fd', '#c4b5fd', '#fdba74']
const STICKY_COLORS_DARK  = ['#92400e', '#9f1239', '#166534', '#1e3a8a', '#4c1d95', '#7c2d12']

// 텍스트 박스 색상 팔레트 (편집 툴바)
const WIDTHS = [2, 4, 6, 10, 16]

let _idCtr = 0
const newId = () => `s${Date.now()}_${_idCtr++}`

// 구형 TextBox 포맷(text/bold/italic/…) → 신형(html/blockType) 마이그레이션
function migrateTextBoxes(boxes: any[]): TextBox[] {
  return boxes.map((tb): TextBox => {
    if ('html' in tb) return tb as TextBox
    // legacy → html 변환
    const parts: string[] = []
    if (tb.bold)          parts.push('font-weight:bold')
    if (tb.italic)        parts.push('font-style:italic')
    const deco = [tb.underline && 'underline', tb.strikethrough && 'line-through'].filter(Boolean).join(' ')
    if (deco)             parts.push(`text-decoration:${deco}`)
    if (tb.color)         parts.push(`color:${tb.color}`)
    const style = parts.join(';')
    const raw   = (tb.text ?? '').replace(/\n/g, '<br>')
    const html  = raw ? (style ? `<span style="${style}">${raw}</span>` : raw) : ''
    return { id: tb.id, x: tb.x, y: tb.y, width: tb.width ?? 200,
             html, blockType: 'p', fontSize: tb.fontSize ?? 16, align: tb.align ?? 'left' }
  })
}

// 블록 타입별 실제 폰트 크기
const getBlockFontSize = (tb: TextBox) =>
  tb.blockType === 'h1' ? 32 : tb.blockType === 'h2' ? 24 : tb.blockType === 'h3' ? 20 : tb.fontSize

// ─── Draw helpers ─────────────────────────────────────────────────────────────

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const { points, color, width, opacity, isShape } = stroke
  if (points.length === 0) return
  ctx.save()
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = opacity
  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2)
    ctx.fillStyle = color; ctx.fill()
  } else if (isShape) {
    // 도형: lineTo로 정확한 엣지 렌더링
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i + 1].x) / 2
      const my = (points[i].y + points[i + 1].y) / 2
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my)
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
    ctx.stroke()
  }
  ctx.restore()
}

// ── 다각형 내부 판별 (lasso 선택용) ──────────────────────────────────────────
function pointInPolygon(px: number, py: number, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DrawingCanvas({ initialData, onChange }: DrawingCanvasProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const committedRef  = useRef<HTMLCanvasElement>(null)
  const activeRef     = useRef<HTMLCanvasElement>(null)
  const dpr = window.devicePixelRatio || 1

  type DrawTool = 'pen' | 'highlighter' | 'eraser' | 'text' | 'pan' | 'select' | 'sticky' | 'shapes' | 'image'
  type Category = 'select' | 'pen' | 'eraser' | 'highlighter' | 'text' | 'shapes' | 'sticky'

  // ── 다크모드 감지 ──────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  // ── 툴 & 색상 state ────────────────────────────────────────────────────────
  const [tool, setTool]                     = useState<DrawTool>('pen')
  const [penColorIdx, setPenColorIdx]       = useState(0)
  const [hlColorIdx, setHlColorIdx]         = useState(1)   // 1 = 노랑
  const [penWidth, setPenWidth]             = useState(4)
  const [_activeCategory, setActiveCategory] = useState<Category | null>('pen')
  const [stickyColor, setStickyColor]       = useState(STICKY_COLORS_LIGHT[0])

  // 파생 색상 (렌더마다 계산)
  const penColor = (isDark ? PEN_COLORS_DARK : PEN_COLORS_LIGHT)[penColorIdx]
  const hlColor  = (isDark ? HL_COLORS_DARK  : HL_COLORS_LIGHT)[hlColorIdx]
  const currentStickyColors = isDark ? STICKY_COLORS_DARK : STICKY_COLORS_LIGHT

  // stale closure 방지용 ref — onPointerDown 등 useCallback 내부에서 사용
  const penColorRef  = useRef(penColor)
  const hlColorRef   = useRef(hlColor)
  const penWidthRef  = useRef(penWidth)
  penColorRef.current  = penColor
  hlColorRef.current   = hlColor
  penWidthRef.current  = penWidth

  // ── Canvas refs ────────────────────────────────────────────────────────────
  const strokesRef       = useRef<Stroke[]>(initialData?.strokes ?? [])
  const offsetRef        = useRef({ x: 0, y: 0 })
  const scaleRef         = useRef(1)
  const isDrawingRef     = useRef(false)
  const isPanningRef     = useRef(false)
  const currentStrokeRef = useRef<Stroke | null>(null)
  const lastPanRef       = useRef({ x: 0, y: 0 })
  const undoStackRef     = useRef<Stroke[][]>([])
  const redoStackRef     = useRef<Stroke[][]>([])
  const scaleSpanRef     = useRef<HTMLSpanElement>(null)

  // ── Selection refs ────────────────────────────────────────────────────────
  type SelectItem = { type: 'stroke' | 'image' | 'textbox' | 'sticky'; id: string }
  const selectedItemsRef = useRef<SelectItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  // 플로팅 서브패널 open 상태
  const [openSubPanel, setOpenSubPanel] = useState<'pen' | 'eraser' | 'highlighter' | 'sticky' | 'select' | 'shapes' | 'image' | 'text' | null>(null)

  // ── 텍스트 기본값 (새 텍스트박스 생성 시 적용) ──────────────────────────────
  const [textDefBlockType, setTextDefBlockType] = useState<TextBox['blockType']>('p')
  const [textDefAlign,     setTextDefAlign]     = useState<'left' | 'center' | 'right'>('left')

  // ── TextBlockEditor 연동 상태 ──────────────────────────────────────────────
  const focusedEditorRef  = useRef<Editor | null>(null)
  const [pendingFocusId,  setPendingFocusId]   = useState<string | null>(null)
  const [currentBlockType, setCurrentBlockType] = useState<TextBox['blockType']>('p')
  const [currentAlign,    setCurrentAlign]      = useState<'left' | 'center' | 'right'>('left')
  const [currentFormat,   setCurrentFormat]     = useState({ bold: false, italic: false, underline: false, strike: false })
  // 선택 모드: 사각 드래그 vs 올가미
  const [selectMode, setSelectMode] = useState<'rect' | 'lasso'>('rect')
  const selectModeRef = useRef<'rect' | 'lasso'>('rect')
  selectModeRef.current = selectMode
  // 도형 타입
  const [shapeType, setShapeType] = useState<'circle' | 'rect' | 'star' | 'line'>('rect')
  const shapeTypeRef = useRef<'circle' | 'rect' | 'star' | 'line'>('rect')
  shapeTypeRef.current = shapeType
  // 도형 전용 색상·굵기
  const [shapeColorIdx, setShapeColorIdx] = useState(0)
  const [shapeWidth, setShapeWidth]       = useState(4)
  const shapeColor    = (isDark ? PEN_COLORS_DARK : PEN_COLORS_LIGHT)[shapeColorIdx]
  const shapeColorRef = useRef(shapeColor)
  const shapeWidthRef = useRef(shapeWidth)
  shapeColorRef.current = shapeColor
  shapeWidthRef.current = shapeWidth
  // 도형 선택 (shapes 모드에서 기존 도형 클릭 → resize UI)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const selectedShapeIdRef = useRef<string | null>(null)
  selectedShapeIdRef.current = selectedShapeId
  const shapeResizeRef = useRef<{
    id: string
    handle: 'tl' | 'tr' | 'bl' | 'br'
    origPoints: Point[]
    bbox: { minX: number; minY: number; maxX: number; maxY: number }
  } | null>(null)
  // 이미지 선택 (image 모드에서 기존 이미지 클릭 → resize/move UI)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const selectedImageIdRef = useRef<string | null>(null)
  selectedImageIdRef.current = selectedImageId
  const imageResizeRef = useRef<{
    id: string
    handle: 'tl' | 'tr' | 'bl' | 'br'
    origImg: { x: number; y: number; width: number; height: number }
  } | null>(null)
  const imageMoveRef = useRef<{
    id: string; startWx: number; startWy: number; origX: number; origY: number
  } | null>(null)
  // 크롭 모드
  const [isCropping, setIsCropping] = useState(false)
  const isCroppingRef = useRef(false)
  isCroppingRef.current = isCropping
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const cropRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  cropRectRef.current = cropRect
  const cropDragRef = useRef<{
    handle: 'tl' | 'tr' | 'bl' | 'br' | 'move'
    startWx: number; startWy: number
    origRect: { x: number; y: number; w: number; h: number }
  } | null>(null)
  // 이미지 미리보기 URL
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const imagePreviewUrlRef = useRef<string | null>(null)
  imagePreviewUrlRef.current = imagePreviewUrl
  const selectDragRef    = useRef<{
    startWx: number; startWy: number; hasMoved: boolean
    preStateStrokes: Stroke[]
    items: Array<{ type: SelectItem['type']; id: string; origPoints?: Point[]; origX?: number; origY?: number }>
  } | null>(null)
  const rubberBandRef    = useRef<{
    startX: number; startY: number; endX: number; endY: number; isShift: boolean
  } | null>(null)
  const lassoRef         = useRef<{ points: Point[]; isShift: boolean } | null>(null)
  const shapeDrawRef     = useRef<{ startWx: number; startWy: number } | null>(null)

  const syncSelectedIds = useCallback(() => {
    setSelectedIds(new Set(selectedItemsRef.current.map(i => i.id)))
  }, [])

  // ── History UI state ──────────────────────────────────────────────────────
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  // ── Palm rejection ────────────────────────────────────────────────────────
  const isPenDownRef   = useRef(false)
  const activePenIdRef = useRef<number | null>(null)

  // ── Text boxes ────────────────────────────────────────────────────────────
  const [textBoxes, setTextBoxes]       = useState<TextBox[]>(() => migrateTextBoxes(initialData?.textBoxes ?? []))
  const textBoxesRef                    = useRef<TextBox[]>(migrateTextBoxes(initialData?.textBoxes ?? []))
  const [focusedBoxId, setFocusedBoxId] = useState<string | null>(null)
  const transformLayerRef               = useRef<HTMLDivElement>(null)
  // mousedown 시점에 포커스된 박스가 있었는지 기록 (blur→재렌더→click 순서로 새 박스 생성되는 버그 방지)
  const hadFocusedBoxOnMouseDownRef     = useRef(false)
  const hadFocusedStickyOnMouseDownRef  = useRef(false)

  // ── Sticky notes ──────────────────────────────────────────────────────────
  const [stickyNotes, setStickyNotes]           = useState<StickyNote[]>(initialData?.stickyNotes ?? [])
  const stickyNotesRef                          = useRef<StickyNote[]>(initialData?.stickyNotes ?? [])
  const [focusedStickyId, setFocusedStickyId]   = useState<string | null>(null)
  const pendingStickyFocusRef                   = useRef<string | null>(null)

  // ── Canvas images ─────────────────────────────────────────────────────────
  const imagesRef    = useRef<CanvasImage[]>(initialData?.images ?? [])
  const imageCache   = useRef<Map<string, HTMLImageElement>>(new Map())
  const imageInputRef = useRef<HTMLInputElement>(null)

  // ── 단축키용 refs (한/영 모드 공통, Space 임시 패닝) ──────────────────────
  const toolRef               = useRef(tool)
  const prevToolBeforeSpaceRef = useRef<DrawTool | null>(null)
  toolRef.current = tool

  // ── Canvas helpers ────────────────────────────────────────────────────────

  const getCtx = useCallback((ref: React.RefObject<HTMLCanvasElement | null>) =>
    ref.current?.getContext('2d') ?? null, [])

  const buildTransform = useCallback(() => ({
    tx: offsetRef.current.x * dpr,
    ty: offsetRef.current.y * dpr,
    s:  scaleRef.current * dpr,
  }), [dpr])

  const resizeCanvas = useCallback((canvas: HTMLCanvasElement, w: number, h: number) => {
    canvas.width  = w * dpr;  canvas.height = h * dpr
    canvas.style.width  = `${w}px`; canvas.style.height = `${h}px`
  }, [dpr])

  const updateTransformLayer = useCallback(() => {
    if (!transformLayerRef.current) return
    const { x, y } = offsetRef.current
    transformLayerRef.current.style.transform =
      `matrix(${scaleRef.current}, 0, 0, ${scaleRef.current}, ${x}, ${y})`
  }, [])

  const syncHistory = useCallback(() => {
    setUndoCount(undoStackRef.current.length)
    setRedoCount(redoStackRef.current.length)
  }, [])

  const emit = useCallback(() => {
    onChange({
      type: 'drawing',
      strokes: strokesRef.current,
      textBoxes: textBoxesRef.current,
      images: imagesRef.current,
      stickyNotes: stickyNotesRef.current,
      version: 1,
    })
  }, [onChange])

  // ── 도형 resize 핸들 렌더 ────────────────────────────────────────────────

  const drawResizeHandles = useCallback((strokeId: string) => {
    const ctx = getCtx(activeRef)
    if (!ctx || !activeRef.current) return
    const stroke = strokesRef.current.find(s => s.id === strokeId)
    if (!stroke) return
    ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    const { tx, ty, s } = buildTransform()
    ctx.save(); ctx.setTransform(s, 0, 0, s, tx, ty)
    const xs = stroke.points.map(p => p.x), ys = stroke.points.map(p => p.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const maxX = Math.max(...xs), maxY = Math.max(...ys)
    const pad = 8 / s
    // 바운딩 박스
    ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5 / s
    ctx.setLineDash([5/s, 3/s]); ctx.globalAlpha = 0.7
    ctx.strokeRect(minX - pad, minY - pad, (maxX - minX) + pad * 2, (maxY - minY) + pad * 2)
    // 코너 핸들 4개
    ctx.setLineDash([]); ctx.globalAlpha = 1
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5 / s
    const hw = 8 / s
    for (const [cx, cy] of [
      [minX - pad, minY - pad], [maxX + pad, minY - pad],
      [minX - pad, maxY + pad], [maxX + pad, maxY + pad],
    ] as [number, number][]) {
      ctx.beginPath(); ctx.rect(cx - hw/2, cy - hw/2, hw, hw); ctx.fill(); ctx.stroke()
    }
    ctx.restore()
  }, [getCtx, buildTransform])

  // ── 이미지 resize 핸들 렌더 ───────────────────────────────────────────────

  const drawImageResizeHandles = useCallback((imageId: string) => {
    const ctx = getCtx(activeRef)
    if (!ctx || !activeRef.current) return
    const img = imagesRef.current.find(i => i.id === imageId)
    if (!img) return
    ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    const { tx, ty, s } = buildTransform()
    ctx.save(); ctx.setTransform(s, 0, 0, s, tx, ty)
    const pad = 8 / s
    ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5 / s
    ctx.setLineDash([5/s, 3/s]); ctx.globalAlpha = 0.7
    ctx.strokeRect(img.x - pad, img.y - pad, img.width + pad * 2, img.height + pad * 2)
    ctx.setLineDash([]); ctx.globalAlpha = 1
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5 / s
    const hw = 8 / s
    for (const [cx, cy] of [
      [img.x - pad, img.y - pad], [img.x + img.width + pad, img.y - pad],
      [img.x - pad, img.y + img.height + pad], [img.x + img.width + pad, img.y + img.height + pad],
    ] as [number, number][]) {
      ctx.beginPath(); ctx.rect(cx - hw/2, cy - hw/2, hw, hw); ctx.fill(); ctx.stroke()
    }
    ctx.restore()
  }, [getCtx, buildTransform])

  // ── 크롭 오버레이 렌더 ────────────────────────────────────────────────────

  const drawCropOverlay = useCallback((imageId: string, rect: { x: number; y: number; w: number; h: number }) => {
    const ctx = getCtx(activeRef)
    if (!ctx || !activeRef.current) return
    const img = imagesRef.current.find(i => i.id === imageId)
    if (!img) return
    ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    const { tx, ty, s } = buildTransform()
    ctx.save(); ctx.setTransform(s, 0, 0, s, tx, ty)
    // 크롭 영역 밖 어두운 오버레이 (evenodd cut-out)
    ctx.fillStyle = 'rgba(0,0,0,0.48)'
    ctx.beginPath()
    ctx.rect(img.x, img.y, img.width, img.height)
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.fill('evenodd')
    // 크롭 테두리
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / s; ctx.setLineDash([])
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
    // 삼등분선 (rule of thirds)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.5 / s
    ctx.beginPath()
    ctx.moveTo(rect.x + rect.w / 3, rect.y); ctx.lineTo(rect.x + rect.w / 3, rect.y + rect.h)
    ctx.moveTo(rect.x + rect.w * 2 / 3, rect.y); ctx.lineTo(rect.x + rect.w * 2 / 3, rect.y + rect.h)
    ctx.moveTo(rect.x, rect.y + rect.h / 3); ctx.lineTo(rect.x + rect.w, rect.y + rect.h / 3)
    ctx.moveTo(rect.x, rect.y + rect.h * 2 / 3); ctx.lineTo(rect.x + rect.w, rect.y + rect.h * 2 / 3)
    ctx.stroke()
    // 코너 핸들
    const hw = 8 / s
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 1.5 / s
    for (const [cx2, cy2] of [
      [rect.x, rect.y], [rect.x + rect.w, rect.y],
      [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h],
    ] as [number, number][]) {
      ctx.beginPath(); ctx.rect(cx2 - hw / 2, cy2 - hw / 2, hw, hw); ctx.fill(); ctx.stroke()
    }
    ctx.restore()
  }, [getCtx, buildTransform])

  // ── Committed canvas redraw ────────────────────────────────────────────────

  const redrawCommitted = useCallback(() => {
    const ctx = getCtx(committedRef)
    if (!ctx || !committedRef.current) return
    ctx.clearRect(0, 0, committedRef.current.width, committedRef.current.height)
    const { tx, ty, s } = buildTransform()
    ctx.save()
    ctx.setTransform(s, 0, 0, s, tx, ty)

    for (const img of imagesRef.current) {
      const cached = imageCache.current.get(img.id)
      if (cached?.complete) {
        ctx.drawImage(cached, img.x, img.y, img.width, img.height)
      } else if (!cached) {
        const el = new window.Image()
        el.src = img.src
        imageCache.current.set(img.id, el)
        el.onload = () => redrawCommitted()
      }
    }

    for (const stroke of strokesRef.current) renderStroke(ctx, stroke)

    // Selection highlight (multi – all 4 types)
    for (const selItem of selectedItemsRef.current) {
      const { type, id } = selItem
      const lw   = 2 / scaleRef.current
      const dash = [5 / scaleRef.current, 3 / scaleRef.current]
      if (type === 'stroke') {
        const sel = strokesRef.current.find(s => s.id === id)
        if (sel?.points.length) {
          const xs = sel.points.map(p => p.x), ys = sel.points.map(p => p.y)
          const pad = Math.max(sel.width, 8) / scaleRef.current
          ctx.save()
          ctx.strokeStyle = '#6366f1'; ctx.lineWidth = lw; ctx.setLineDash(dash); ctx.globalAlpha = 0.7
          ctx.strokeRect(Math.min(...xs) - pad, Math.min(...ys) - pad,
            (Math.max(...xs) - Math.min(...xs)) + pad * 2,
            (Math.max(...ys) - Math.min(...ys)) + pad * 2)
          ctx.restore()
        }
      } else if (type === 'image') {
        const img = imagesRef.current.find(i => i.id === id)
        if (img) {
          const pad = 4 / scaleRef.current
          ctx.save()
          ctx.strokeStyle = '#6366f1'; ctx.lineWidth = lw; ctx.setLineDash(dash); ctx.globalAlpha = 0.7
          ctx.strokeRect(img.x - pad, img.y - pad, img.width + pad * 2, img.height + pad * 2)
          ctx.restore()
        }
      } else if (type === 'textbox') {
        const tb = textBoxesRef.current.find(t => t.id === id)
        if (tb) {
          const pad = 4 / scaleRef.current
          const estH = Math.max(getBlockFontSize(tb) * 2.5, 40)
          ctx.save()
          ctx.strokeStyle = '#6366f1'; ctx.lineWidth = lw; ctx.setLineDash(dash); ctx.globalAlpha = 0.7
          ctx.strokeRect(tb.x - pad, tb.y - pad, (tb.width + 150) + pad * 2, estH + pad * 2)
          ctx.restore()
        }
      } else if (type === 'sticky') {
        const n = stickyNotesRef.current.find(s => s.id === id)
        if (n) {
          const pad = 4 / scaleRef.current
          ctx.save()
          ctx.strokeStyle = '#6366f1'; ctx.lineWidth = lw; ctx.setLineDash(dash); ctx.globalAlpha = 0.7
          ctx.strokeRect(n.x - pad, n.y - pad, n.width + pad * 2, n.height + pad * 2)
          ctx.restore()
        }
      }
    }
    ctx.restore()
    updateTransformLayer()
    // shapes 모드에서 선택된 도형의 resize 핸들 유지
    if (selectedShapeIdRef.current && toolRef.current === 'shapes') {
      drawResizeHandles(selectedShapeIdRef.current)
    }
    // image 모드에서 선택된 이미지의 resize 핸들 또는 크롭 오버레이 유지
    if (selectedImageIdRef.current && toolRef.current === 'image') {
      if (isCroppingRef.current && cropRectRef.current) {
        drawCropOverlay(selectedImageIdRef.current, cropRectRef.current)
      } else {
        drawImageResizeHandles(selectedImageIdRef.current)
      }
    }
  }, [getCtx, buildTransform, updateTransformLayer, drawResizeHandles, drawImageResizeHandles, drawCropOverlay])

  // ── 사각 선택 시각화 ────────────────────────────────────────────────────────

  const drawRubberBand = useCallback(() => {
    const ctx = getCtx(activeRef)
    if (!ctx || !activeRef.current || !rubberBandRef.current) return
    ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    const { startX, startY, endX, endY } = rubberBandRef.current
    const { tx, ty, s } = buildTransform()
    ctx.save()
    ctx.setTransform(s, 0, 0, s, tx, ty)
    const x = Math.min(startX, endX), y = Math.min(startY, endY)
    const w = Math.abs(endX - startX), h = Math.abs(endY - startY)
    ctx.fillStyle   = 'rgba(99,102,241,0.07)'
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth   = 1.5 / scaleRef.current
    ctx.setLineDash([5 / scaleRef.current, 3 / scaleRef.current])
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke()
    ctx.restore()
  }, [getCtx, buildTransform])

  // ── 올가미 선택 시각화 ────────────────────────────────────────────────────

  const drawLasso = useCallback(() => {
    const ctx = getCtx(activeRef)
    if (!ctx || !activeRef.current || !lassoRef.current) return
    ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    const pts = lassoRef.current.points
    if (pts.length < 2) return
    const { tx, ty, s } = buildTransform()
    ctx.save()
    ctx.setTransform(s, 0, 0, s, tx, ty)
    ctx.fillStyle   = 'rgba(99,102,241,0.07)'
    ctx.strokeStyle = '#6366f1'
    ctx.lineWidth   = 1.5 / scaleRef.current
    ctx.setLineDash([5 / scaleRef.current, 3 / scaleRef.current])
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.restore()
  }, [getCtx, buildTransform])

  // ── 도형 미리보기 ────────────────────────────────────────────────────────

  const drawShapePreview = useCallback((sx: number, sy: number, ex: number, ey: number) => {
    const ctx = getCtx(activeRef)
    if (!ctx || !activeRef.current) return
    ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    const { tx, ty, s } = buildTransform()
    ctx.save(); ctx.setTransform(s, 0, 0, s, tx, ty)
    ctx.strokeStyle = shapeColorRef.current; ctx.lineWidth = shapeWidthRef.current
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([])
    const cx = (sx + ex) / 2, cy = (sy + ey) / 2
    const rx = Math.abs(ex - sx) / 2, ry = Math.abs(ey - sy) / 2
    ctx.beginPath()
    const st = shapeTypeRef.current
    if (st === 'line') {
      ctx.moveTo(sx, sy); ctx.lineTo(ex, ey)
    } else if (st === 'rect') {
      ctx.rect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy))
    } else if (st === 'circle') {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    } else if (st === 'star') {
      const or = Math.max(rx, ry), ir = or * 0.4
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? or : ir
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
        else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
      }; ctx.closePath()
    }
    ctx.stroke(); ctx.restore()
  }, [getCtx, buildTransform])

  // ── 도형 확정 (stroke로 저장) ─────────────────────────────────────────────

  const commitShape = useCallback((sx: number, sy: number, ex: number, ey: number) => {
    const cx = (sx + ex) / 2, cy = (sy + ey) / 2
    const rx = Math.abs(ex - sx) / 2, ry = Math.abs(ey - sy) / 2
    const st = shapeTypeRef.current
    let pts: Point[] = []
    if (st === 'line') {
      pts = [{ x: sx, y: sy, pressure: 0.5 }, { x: ex, y: ey, pressure: 0.5 }]
    } else if (st === 'rect') {
      const x1 = Math.min(sx, ex), y1 = Math.min(sy, ey)
      const x2 = Math.max(sx, ex), y2 = Math.max(sy, ey)
      pts = [
        { x: x1, y: y1, pressure: 0.5 }, { x: x2, y: y1, pressure: 0.5 },
        { x: x2, y: y2, pressure: 0.5 }, { x: x1, y: y2, pressure: 0.5 },
        { x: x1, y: y1, pressure: 0.5 },
      ]
    } else if (st === 'circle') {
      pts = Array.from({ length: 37 }, (_, i) => {
        const a = (i / 36) * Math.PI * 2
        return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), pressure: 0.5 }
      })
    } else if (st === 'star') {
      const or = Math.max(rx, ry), ir = or * 0.4
      pts = Array.from({ length: 11 }, (_, i) => {
        const r = i % 2 === 0 ? or : ir
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), pressure: 0.5 }
      })
    }
    if (pts.length < 2) return
    const newStroke: Stroke = {
      id: newId(), points: pts,
      color: shapeColorRef.current, width: shapeWidthRef.current,
      opacity: 1, tool: 'pen', isShape: true,
    }
    undoStackRef.current.push(strokesRef.current.map(s => ({ ...s, points: [...s.points] })))
    redoStackRef.current = []; if (undoStackRef.current.length > 50) undoStackRef.current.shift()
    strokesRef.current = [...strokesRef.current, newStroke]
    syncHistory(); redrawCommitted(); emit()
  }, [syncHistory, redrawCommitted, emit])

  // ── Resize ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      if (!width || !height) return
      if (committedRef.current) resizeCanvas(committedRef.current, width, height)
      if (activeRef.current)    resizeCanvas(activeRef.current,    width, height)
      redrawCommitted()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [resizeCanvas, redrawCommitted])

  // ── 다크모드 observer ─────────────────────────────────────────────────────

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // 다크모드 전환 시 포스트잇 선택색 동기화
  useEffect(() => {
    const lightIdx = STICKY_COLORS_LIGHT.indexOf(stickyColor)
    const darkIdx  = STICKY_COLORS_DARK.indexOf(stickyColor)
    const idx = lightIdx >= 0 ? lightIdx : darkIdx >= 0 ? darkIdx : 0
    setStickyColor(isDark ? STICKY_COLORS_DARK[idx] : STICKY_COLORS_LIGHT[idx])
  }, [isDark]) // eslint-disable-line react-hooks/exhaustive-deps

  // 다크모드 전환 시 기존 스트로크 색상 자동 변환 (라이트↔다크 팔레트 매핑)
  useEffect(() => {
    const fromPen = isDark ? PEN_COLORS_LIGHT : PEN_COLORS_DARK
    const toPen   = isDark ? PEN_COLORS_DARK  : PEN_COLORS_LIGHT
    const fromHl  = isDark ? HL_COLORS_LIGHT  : HL_COLORS_DARK
    const toHl    = isDark ? HL_COLORS_DARK   : HL_COLORS_LIGHT

    let changed = false
    const newStrokes = strokesRef.current.map(stroke => {
      const penIdx = (fromPen as readonly string[]).indexOf(stroke.color)
      if (penIdx >= 0) { changed = true; return { ...stroke, color: toPen[penIdx] } }
      const hlIdx  = (fromHl  as readonly string[]).indexOf(stroke.color)
      if (hlIdx  >= 0) { changed = true; return { ...stroke, color: toHl[hlIdx]  } }
      return stroke
    })

    if (changed) {
      strokesRef.current = newStrokes
      redrawCommitted()
      emit()
    }
  }, [isDark]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── World coords ──────────────────────────────────────────────────────────

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = committedRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left  - offsetRef.current.x) / scaleRef.current,
      y: (clientY - rect.top   - offsetRef.current.y) / scaleRef.current,
    }
  }, [])

  // ── Active stroke preview ─────────────────────────────────────────────────

  const drawActiveStroke = useCallback(() => {
    const ctx = getCtx(activeRef)
    if (!ctx || !activeRef.current) return
    ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    const stroke = currentStrokeRef.current
    if (!stroke) return
    const { tx, ty, s } = buildTransform()
    ctx.save()
    ctx.setTransform(s, 0, 0, s, tx, ty)
    if (stroke.tool === 'eraser') {
      const lastPt = stroke.points[stroke.points.length - 1]
      if (lastPt) {
        ctx.beginPath()
        ctx.arc(lastPt.x, lastPt.y, stroke.width / 2, 0, Math.PI * 2)
        ctx.strokeStyle = '#999'; ctx.lineWidth = 1.5; ctx.stroke()
      }
    } else {
      renderStroke(ctx, stroke)
    }
    ctx.restore()
  }, [getCtx, buildTransform])

  // ── 지우개 실시간 적용 ─────────────────────────────────────────────────────

  const applyEraser = useCallback((pt: { x: number; y: number }, eraserWidth: number) => {
    const radius = (eraserWidth / 2) / scaleRef.current
    const toRemove = new Set<string>()
    for (const s of strokesRef.current) {
      for (const sp of s.points) {
        if (Math.hypot(sp.x - pt.x, sp.y - pt.y) < radius) { toRemove.add(s.id); break }
      }
    }
    if (toRemove.size > 0) {
      strokesRef.current = strokesRef.current.filter(s => !toRemove.has(s.id))
      redrawCommitted()
    }
  }, [redrawCommitted])

  // ── Pointer events ────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setOpenSubPanel(null)  // 캔버스 터치 시 플로팅 서브패널 닫기

    if (e.pointerType === 'pen') {
      isPenDownRef.current = true; activePenIdRef.current = e.pointerId
    }
    if (e.pointerType === 'touch') {
      if (isPenDownRef.current) return
      isPanningRef.current = true; lastPanRef.current = { x: e.clientX, y: e.clientY }; return
    }
    if (tool === 'image') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      const hw = 10 / scaleRef.current
      // ── 크롭 모드: 크롭 핸들 / 이동 처리 ────────────────────────────────
      if (isCroppingRef.current && cropRectRef.current) {
        const rect = cropRectRef.current
        const corners: ['tl' | 'tr' | 'bl' | 'br', number, number][] = [
          ['tl', rect.x, rect.y], ['tr', rect.x + rect.w, rect.y],
          ['bl', rect.x, rect.y + rect.h], ['br', rect.x + rect.w, rect.y + rect.h],
        ]
        for (const [handle, hx, hy] of corners) {
          if (Math.abs(x - hx) < hw && Math.abs(y - hy) < hw) {
            cropDragRef.current = { handle, startWx: x, startWy: y, origRect: { ...rect } }
            return
          }
        }
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
          cropDragRef.current = { handle: 'move', startWx: x, startWy: y, origRect: { ...rect } }
        }
        return
      }
      // 선택된 이미지가 있을 때: 코너 핸들 hit 체크
      if (selectedImageIdRef.current) {
        const img = imagesRef.current.find(i => i.id === selectedImageIdRef.current)
        if (img) {
          const pad = 8 / scaleRef.current
          const corners: ['tl' | 'tr' | 'bl' | 'br', number, number][] = [
            ['tl', img.x - pad, img.y - pad],
            ['tr', img.x + img.width + pad, img.y - pad],
            ['bl', img.x - pad, img.y + img.height + pad],
            ['br', img.x + img.width + pad, img.y + img.height + pad],
          ]
          for (const [handle, hx, hy] of corners) {
            if (Math.abs(x - hx) < hw && Math.abs(y - hy) < hw) {
              imageResizeRef.current = {
                id: selectedImageIdRef.current, handle,
                origImg: { x: img.x, y: img.y, width: img.width, height: img.height },
              }
              return
            }
          }
        }
      }
      // 기존 이미지 hit 체크 → 선택 + 이동 준비
      const hitImage = [...imagesRef.current].reverse().find(img =>
        x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height
      )
      if (hitImage) {
        setSelectedImageId(hitImage.id)
        setImagePreviewUrl(hitImage.src)
        imageMoveRef.current = { id: hitImage.id, startWx: x, startWy: y, origX: hitImage.x, origY: hitImage.y }
        return
      }
      // 빈 영역 클릭 → 선택 해제
      setSelectedImageId(null)
      const actCtx = getCtx(activeRef)
      if (actCtx && activeRef.current) actCtx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
      return
    }

    if (tool === 'pan') {
      isPanningRef.current = true; lastPanRef.current = { x: e.clientX, y: e.clientY }; return
    }

    if (tool === 'select') {
      const { x, y } = toWorld(e.clientX, e.clientY)
      const isShift = e.shiftKey
      const hitThreshold = 15 / scaleRef.current
      const hitStroke = [...strokesRef.current].reverse().find(s =>
        s.points.some(p => Math.hypot(p.x - x, p.y - y) < hitThreshold)
      )
      const hitImage = !hitStroke && [...imagesRef.current].reverse().find(img =>
        x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height
      )
      const hitTextBox = !hitStroke && !hitImage && [...textBoxesRef.current].reverse().find(tb => {
        const estH = Math.max(getBlockFontSize(tb) * 2.5, 40)
        return x >= tb.x && x <= tb.x + tb.width + 150 && y >= tb.y && y <= tb.y + estH
      })
      const hitStickyNote = !hitStroke && !hitImage && !hitTextBox &&
        [...stickyNotesRef.current].reverse().find(n =>
          x >= n.x && x <= n.x + n.width && y >= n.y && y <= n.y + n.height
        )

      const hitItem: SelectItem | null =
        hitStroke     ? { type: 'stroke',  id: hitStroke.id     } :
        hitImage      ? { type: 'image',   id: hitImage.id      } :
        hitTextBox    ? { type: 'textbox', id: hitTextBox.id    } :
        hitStickyNote ? { type: 'sticky',  id: hitStickyNote.id } : null

      if (hitItem) {
        const alreadySelected = selectedItemsRef.current.some(i => i.id === hitItem.id)
        if (isShift) {
          // Shift+click: toggle item in/out of selection
          if (alreadySelected) {
            selectedItemsRef.current = selectedItemsRef.current.filter(i => i.id !== hitItem.id)
          } else {
            selectedItemsRef.current = [...selectedItemsRef.current, hitItem]
          }
          selectDragRef.current = null
        } else {
          // Normal click: if not already selected, replace selection with this item
          if (!alreadySelected) selectedItemsRef.current = [hitItem]
          // Build drag state for all currently selected items
          selectDragRef.current = {
            startWx: x, startWy: y, hasMoved: false,
            preStateStrokes: strokesRef.current.map(s => ({ ...s, points: [...s.points] })),
            items: selectedItemsRef.current.map(item => {
              if (item.type === 'stroke') {
                const s = strokesRef.current.find(s => s.id === item.id)
                return { ...item, origPoints: s ? s.points.map(p => ({ ...p })) : [] }
              }
              if (item.type === 'image') {
                const img = imagesRef.current.find(i => i.id === item.id)
                return { ...item, origX: img?.x, origY: img?.y }
              }
              if (item.type === 'textbox') {
                const tb = textBoxesRef.current.find(t => t.id === item.id)
                return { ...item, origX: tb?.x, origY: tb?.y }
              }
              const n = stickyNotesRef.current.find(n => n.id === item.id)
              return { ...item, origX: n?.x, origY: n?.y }
            }),
          }
        }
        rubberBandRef.current = null
        syncSelectedIds()
      } else {
        // Clicked on empty space
        if (!isShift) {
          selectedItemsRef.current = []
          syncSelectedIds()
        }
        selectDragRef.current = null
        if (selectModeRef.current === 'lasso') {
          lassoRef.current = { points: [{ x, y, pressure: 0.5 }], isShift }
          rubberBandRef.current = null
        } else {
          rubberBandRef.current = { startX: x, startY: y, endX: x, endY: y, isShift }
          lassoRef.current = null
        }
      }
      redrawCommitted(); return
    }

    // ── Shapes (도형 그리기 / resize) ───────────────────────────────────────
    if (tool === 'shapes') {
      setOpenSubPanel(null)
      const { x, y } = toWorld(e.clientX, e.clientY)

      // 1. 선택된 도형의 코너 핸들 hit 체크
      if (selectedShapeIdRef.current) {
        const stroke = strokesRef.current.find(s => s.id === selectedShapeIdRef.current)
        if (stroke) {
          const xs = stroke.points.map(p => p.x), ys = stroke.points.map(p => p.y)
          const minX = Math.min(...xs), minY = Math.min(...ys)
          const maxX = Math.max(...xs), maxY = Math.max(...ys)
          const pad = 8 / scaleRef.current
          const hitR = 14 / scaleRef.current
          const corners = [
            { handle: 'tl' as const, cx: minX - pad, cy: minY - pad },
            { handle: 'tr' as const, cx: maxX + pad, cy: minY - pad },
            { handle: 'bl' as const, cx: minX - pad, cy: maxY + pad },
            { handle: 'br' as const, cx: maxX + pad, cy: maxY + pad },
          ]
          const hitCorner = corners.find(c => Math.hypot(c.cx - x, c.cy - y) < hitR)
          if (hitCorner) {
            undoStackRef.current.push(strokesRef.current.map(s => ({ ...s, points: [...s.points] })))
            redoStackRef.current = []; if (undoStackRef.current.length > 50) undoStackRef.current.shift()
            syncHistory()
            shapeResizeRef.current = {
              id: stroke.id, handle: hitCorner.handle,
              origPoints: stroke.points.map(p => ({ ...p })),
              bbox: { minX, minY, maxX, maxY },
            }
            return
          }
        }
      }

      // 2. 기존 도형 stroke hit 체크 → 선택 & resize 핸들 표시
      const hitThreshold = 12 / scaleRef.current
      const hitShape = [...strokesRef.current].reverse().find(s =>
        s.isShape && s.points.some(p => Math.hypot(p.x - x, p.y - y) < hitThreshold)
      )
      if (hitShape) {
        selectedShapeIdRef.current = hitShape.id
        setSelectedShapeId(hitShape.id)
        drawResizeHandles(hitShape.id)
        return
      }

      // 3. 빈 공간 클릭 → 선택 해제 후 새 도형 그리기
      if (selectedShapeIdRef.current) {
        selectedShapeIdRef.current = null
        setSelectedShapeId(null)
        const ctx = getCtx(activeRef)
        if (ctx && activeRef.current) ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
      }
      shapeDrawRef.current = { startWx: x, startWy: y }
      return
    }

    undoStackRef.current.push([...strokesRef.current])
    redoStackRef.current = []
    if (undoStackRef.current.length > 50) undoStackRef.current.shift()
    syncHistory()

    isDrawingRef.current = true
    const { x, y } = toWorld(e.clientX, e.clientY)
    const pressure = e.pressure > 0 ? e.pressure : 0.5
    const isHighlighter = tool === 'highlighter'
    const strokeWidth = tool === 'eraser'
      ? penWidth * 4
      : Math.max(1, penWidth * (isHighlighter ? 1.5 : 0.4 + pressure * 0.8))

    currentStrokeRef.current = {
      id: newId(),
      color: tool === 'eraser' ? '#000' : tool === 'highlighter' ? hlColorRef.current : penColorRef.current,
      width: strokeWidth,
      opacity: isHighlighter ? 0.35 : 1,
      points: [{ x, y, pressure }],
      tool: tool as 'pen' | 'highlighter' | 'eraser',
    }

    // 지우개: 첫 포인트에서 즉시 적용
    if (tool === 'eraser') applyEraser({ x, y }, strokeWidth)

    drawActiveStroke()
  }, [tool, penWidth, toWorld, getCtx, drawActiveStroke, syncHistory, redrawCommitted, applyEraser, syncSelectedIds, drawImageResizeHandles])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanRef.current.x
      const dy = e.clientY - lastPanRef.current.y
      offsetRef.current = { x: offsetRef.current.x + dx, y: offsetRef.current.y + dy }
      lastPanRef.current = { x: e.clientX, y: e.clientY }
      redrawCommitted(); return
    }

    if (tool === 'select') {
      if (selectDragRef.current) {
        const { x, y } = toWorld(e.clientX, e.clientY)
        const drag = selectDragRef.current
        const dx = x - drag.startWx, dy = y - drag.startWy
        if (!drag.hasMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
          // Push undo state only if any stroke is being moved
          if (drag.items.some(i => i.type === 'stroke')) {
            undoStackRef.current.push(drag.preStateStrokes)
            redoStackRef.current = []
            if (undoStackRef.current.length > 50) undoStackRef.current.shift()
            syncHistory()
          }
          drag.hasMoved = true
        }
        if (!drag.hasMoved) return
        let needTextUpdate = false, needStickyUpdate = false
        for (const item of drag.items) {
          if (item.type === 'stroke' && item.origPoints) {
            strokesRef.current = strokesRef.current.map(s =>
              s.id === item.id
                ? { ...s, points: item.origPoints!.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) }
                : s
            )
          } else if (item.type === 'image' && item.origX !== undefined && item.origY !== undefined) {
            imagesRef.current = imagesRef.current.map(i =>
              i.id === item.id ? { ...i, x: item.origX! + dx, y: item.origY! + dy } : i
            )
          } else if (item.type === 'textbox' && item.origX !== undefined && item.origY !== undefined) {
            textBoxesRef.current = textBoxesRef.current.map(t =>
              t.id === item.id ? { ...t, x: item.origX! + dx, y: item.origY! + dy } : t
            )
            needTextUpdate = true
          } else if (item.type === 'sticky' && item.origX !== undefined && item.origY !== undefined) {
            stickyNotesRef.current = stickyNotesRef.current.map(n =>
              n.id === item.id ? { ...n, x: item.origX! + dx, y: item.origY! + dy } : n
            )
            needStickyUpdate = true
          }
        }
        if (needTextUpdate)   setTextBoxes([...textBoxesRef.current])
        if (needStickyUpdate) setStickyNotes([...stickyNotesRef.current])
        redrawCommitted(); return
      }
      if (rubberBandRef.current) {
        const { x, y } = toWorld(e.clientX, e.clientY)
        rubberBandRef.current.endX = x; rubberBandRef.current.endY = y
        drawRubberBand(); return
      }
      if (lassoRef.current) {
        const { x, y } = toWorld(e.clientX, e.clientY)
        lassoRef.current.points.push({ x, y, pressure: 0.5 })
        drawLasso(); return
      }
      return
    }

    // ── 크롭 드래그 ──────────────────────────────────────────────────────────
    if (tool === 'image' && isCroppingRef.current && cropDragRef.current && selectedImageIdRef.current) {
      const { x, y } = toWorld(e.clientX, e.clientY)
      const { handle, startWx, startWy, origRect } = cropDragRef.current
      const img = imagesRef.current.find(i => i.id === selectedImageIdRef.current)
      if (!img) return
      let nr = { ...origRect }
      if (handle === 'move') {
        nr.x = origRect.x + (x - startWx)
        nr.y = origRect.y + (y - startWy)
      } else {
        const pivotX = (handle === 'tl' || handle === 'bl') ? origRect.x + origRect.w : origRect.x
        const pivotY = (handle === 'tl' || handle === 'tr') ? origRect.y + origRect.h : origRect.y
        nr.x = Math.min(x, pivotX); nr.y = Math.min(y, pivotY)
        nr.w = Math.max(10, Math.abs(x - pivotX))
        nr.h = Math.max(10, Math.abs(y - pivotY))
      }
      // 이미지 영역에 클램프
      nr.x = Math.max(img.x, Math.min(nr.x, img.x + img.width  - 10))
      nr.y = Math.max(img.y, Math.min(nr.y, img.y + img.height - 10))
      nr.w = Math.min(nr.w, img.x + img.width  - nr.x)
      nr.h = Math.min(nr.h, img.y + img.height - nr.y)
      cropRectRef.current = nr
      setCropRect(nr)
      drawCropOverlay(selectedImageIdRef.current, nr)
      return
    }

    // ── Image resize 드래그 ──────────────────────────────────────────────────
    if (tool === 'image' && imageResizeRef.current) {
      const { x, y } = toWorld(e.clientX, e.clientY)
      const { id, handle, origImg } = imageResizeRef.current
      const pivotX = (handle === 'tl' || handle === 'bl') ? origImg.x + origImg.width : origImg.x
      const pivotY = (handle === 'tl' || handle === 'tr') ? origImg.y + origImg.height : origImg.y
      const nw = Math.max(20, Math.abs(x - pivotX))
      const nh = Math.max(20, Math.abs(y - pivotY))
      const nx = Math.min(x, pivotX)
      const ny = Math.min(y, pivotY)
      imagesRef.current = imagesRef.current.map(i => i.id === id ? { ...i, x: nx, y: ny, width: nw, height: nh } : i)
      redrawCommitted(); return
    }

    // ── Image move 드래그 ────────────────────────────────────────────────────
    if (tool === 'image' && imageMoveRef.current) {
      const { x, y } = toWorld(e.clientX, e.clientY)
      const { id, startWx, startWy, origX, origY } = imageMoveRef.current
      imagesRef.current = imagesRef.current.map(i =>
        i.id === id ? { ...i, x: origX + (x - startWx), y: origY + (y - startWy) } : i
      )
      redrawCommitted(); return
    }

    // ── Shapes resize 드래그 ─────────────────────────────────────────────────
    if (tool === 'shapes' && shapeResizeRef.current) {
      const { x, y } = toWorld(e.clientX, e.clientY)
      const { id, handle, origPoints, bbox } = shapeResizeRef.current
      const { minX, minY, maxX, maxY } = bbox
      const origW = Math.max(1, maxX - minX), origH = Math.max(1, maxY - minY)
      let nMinX = minX, nMinY = minY, nMaxX = maxX, nMaxY = maxY
      if      (handle === 'tl') { nMinX = x; nMinY = y }
      else if (handle === 'tr') { nMaxX = x; nMinY = y }
      else if (handle === 'bl') { nMinX = x; nMaxY = y }
      else                      { nMaxX = x; nMaxY = y }
      // Shift: 정방형 비율 유지
      if (e.shiftKey) {
        const size = Math.max(Math.abs(nMaxX - nMinX), Math.abs(nMaxY - nMinY))
        if      (handle === 'tl') { nMinX = nMaxX - size; nMinY = nMaxY - size }
        else if (handle === 'tr') { nMaxX = nMinX + size; nMinY = nMaxY - size }
        else if (handle === 'bl') { nMinX = nMaxX - size; nMaxY = nMinY + size }
        else                      { nMaxX = nMinX + size; nMaxY = nMinY + size }
      }
      const newW = Math.max(10, nMaxX - nMinX), newH = Math.max(10, nMaxY - nMinY)
      const scaleX = newW / origW, scaleY = newH / origH
      const pivotX = (handle === 'tl' || handle === 'bl') ? maxX : minX
      const pivotY = (handle === 'tl' || handle === 'tr') ? maxY : minY
      const newPoints = origPoints.map(p => ({
        x: pivotX + (p.x - pivotX) * scaleX,
        y: pivotY + (p.y - pivotY) * scaleY,
        pressure: p.pressure,
      }))
      strokesRef.current = strokesRef.current.map(s => s.id === id ? { ...s, points: newPoints } : s)
      redrawCommitted()
      return
    }

    // ── Shapes move (미리보기) ────────────────────────────────────────────────
    if (tool === 'shapes' && shapeDrawRef.current) {
      let { x, y } = toWorld(e.clientX, e.clientY)
      if (e.shiftKey) {
        const dx = x - shapeDrawRef.current.startWx
        const dy = y - shapeDrawRef.current.startWy
        const size = Math.max(Math.abs(dx), Math.abs(dy))
        x = shapeDrawRef.current.startWx + Math.sign(dx) * size
        y = shapeDrawRef.current.startWy + Math.sign(dy) * size
      }
      drawShapePreview(shapeDrawRef.current.startWx, shapeDrawRef.current.startWy, x, y)
      return
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return
    const { x, y } = toWorld(e.clientX, e.clientY)
    const pressure = e.pressure > 0 ? e.pressure : 0.5
    currentStrokeRef.current.points.push({ x, y, pressure })

    // 지우개: 각 포인트마다 실시간 삭제
    if (currentStrokeRef.current.tool === 'eraser') {
      applyEraser({ x, y }, currentStrokeRef.current.width)
    }

    drawActiveStroke()
  }, [tool, toWorld, drawActiveStroke, drawRubberBand, redrawCommitted, syncHistory, applyEraser, drawCropOverlay])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen' && e.pointerId === activePenIdRef.current) {
      isPenDownRef.current = false; activePenIdRef.current = null
    }
    isPanningRef.current = false

    if (tool === 'select') {
      if (selectDragRef.current?.hasMoved) emit()
      selectDragRef.current = null
      if (rubberBandRef.current) {
        const rb = rubberBandRef.current
        const minX = Math.min(rb.startX, rb.endX), maxX = Math.max(rb.startX, rb.endX)
        const minY = Math.min(rb.startY, rb.endY), maxY = Math.max(rb.startY, rb.endY)
        const activeCtx = getCtx(activeRef)
        if (activeCtx && activeRef.current)
          activeCtx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
        if (maxX - minX > 5 || maxY - minY > 5) {
          const inBox = (px: number, py: number) => px >= minX && px <= maxX && py >= minY && py <= maxY
          const inter = (rx: number, ry: number, rw: number, rh: number) =>
            rx < maxX && rx + rw > minX && ry < maxY && ry + rh > minY
          // Collect ALL items inside the rubber band (not just the first match)
          const newItems: SelectItem[] = []
          for (const s of strokesRef.current) {
            if (s.points.some(p => inBox(p.x, p.y))) newItems.push({ type: 'stroke', id: s.id })
          }
          for (const img of imagesRef.current) {
            if (inter(img.x, img.y, img.width, img.height)) newItems.push({ type: 'image', id: img.id })
          }
          for (const tb of textBoxesRef.current) {
            const tbH = Math.max(getBlockFontSize(tb) * 2.5, 40)
            if (inter(tb.x, tb.y, tb.width + 150, tbH))
              newItems.push({ type: 'textbox', id: tb.id })
          }
          for (const n of stickyNotesRef.current) {
            if (inter(n.x, n.y, n.width, n.height)) newItems.push({ type: 'sticky', id: n.id })
          }
          if (rb.isShift) {
            // Shift+drag: add to existing selection (no duplicates)
            const existing = selectedItemsRef.current
            selectedItemsRef.current = [
              ...existing,
              ...newItems.filter(ni => !existing.some(ei => ei.id === ni.id)),
            ]
          } else {
            selectedItemsRef.current = newItems
          }
          syncSelectedIds()
          redrawCommitted()
        }
        rubberBandRef.current = null
      }
      // ── 올가미 선택 확정 ──────────────────────────────────────────────────
      if (lassoRef.current) {
        const poly = lassoRef.current.points
        const isShift = lassoRef.current.isShift
        const activeCtx2 = getCtx(activeRef)
        if (activeCtx2 && activeRef.current)
          activeCtx2.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
        if (poly.length > 3) {
          const newItems: SelectItem[] = []
          for (const s of strokesRef.current) {
            if (s.points.some(p => pointInPolygon(p.x, p.y, poly)))
              newItems.push({ type: 'stroke', id: s.id })
          }
          for (const img of imagesRef.current) {
            if (pointInPolygon(img.x + img.width / 2, img.y + img.height / 2, poly))
              newItems.push({ type: 'image', id: img.id })
          }
          for (const tb of textBoxesRef.current) {
            const tbH = Math.max(getBlockFontSize(tb) * 2.5, 40)
            if (pointInPolygon(tb.x + (tb.width + 150) / 2, tb.y + tbH / 2, poly))
              newItems.push({ type: 'textbox', id: tb.id })
          }
          for (const n of stickyNotesRef.current) {
            if (pointInPolygon(n.x + n.width / 2, n.y + n.height / 2, poly))
              newItems.push({ type: 'sticky', id: n.id })
          }
          if (isShift) {
            const existing = selectedItemsRef.current
            selectedItemsRef.current = [...existing, ...newItems.filter(ni => !existing.some(ei => ei.id === ni.id))]
          } else {
            selectedItemsRef.current = newItems
          }
          syncSelectedIds(); redrawCommitted()
        }
        lassoRef.current = null
      }
      return
    }

    // ── 크롭 드래그 확정 ─────────────────────────────────────────────────────
    if (tool === 'image' && isCroppingRef.current && cropDragRef.current) {
      cropDragRef.current = null; return
    }

    // ── Image resize 확정 ────────────────────────────────────────────────────
    if (tool === 'image' && imageResizeRef.current) {
      imageResizeRef.current = null; emit()
      if (selectedImageIdRef.current) drawImageResizeHandles(selectedImageIdRef.current)
      return
    }

    // ── Image move 확정 ──────────────────────────────────────────────────────
    if (tool === 'image' && imageMoveRef.current) {
      imageMoveRef.current = null; emit()
      if (selectedImageIdRef.current) drawImageResizeHandles(selectedImageIdRef.current)
      return
    }

    // ── Shapes resize 확정 ───────────────────────────────────────────────────
    if (tool === 'shapes' && shapeResizeRef.current) {
      const resizeId = shapeResizeRef.current.id
      shapeResizeRef.current = null
      selectedShapeIdRef.current = resizeId
      setSelectedShapeId(resizeId)
      emit()
      drawResizeHandles(resizeId)
      return
    }

    // ── Shapes 확정 ──────────────────────────────────────────────────────────
    if (tool === 'shapes' && shapeDrawRef.current) {
      let { x, y } = toWorld(e.clientX, e.clientY)
      const { startWx, startWy } = shapeDrawRef.current
      if (e.shiftKey) {
        const dx = x - startWx
        const dy = y - startWy
        const size = Math.max(Math.abs(dx), Math.abs(dy))
        x = startWx + Math.sign(dx) * size
        y = startWy + Math.sign(dy) * size
      }
      const activeCtx3 = getCtx(activeRef)
      if (activeCtx3 && activeRef.current)
        activeCtx3.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
      if (Math.abs(x - startWx) > 4 || Math.abs(y - startWy) > 4)
        commitShape(startWx, startWy, x, y)
      shapeDrawRef.current = null
      return
    }

    if (!isDrawingRef.current || !currentStrokeRef.current) return
    isDrawingRef.current = false
    const stroke = currentStrokeRef.current
    currentStrokeRef.current = null
    const activeCtx = getCtx(activeRef)
    if (activeCtx && activeRef.current)
      activeCtx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    if (stroke.points.length === 0) return

    // 지우개: 실시간 처리 완료 → 상태 저장만
    if (stroke.tool === 'eraser') { emit(); return }

    strokesRef.current = [...strokesRef.current, stroke]
    const ctx = getCtx(committedRef)
    if (ctx) {
      const { tx, ty, s } = buildTransform()
      ctx.save(); ctx.setTransform(s, 0, 0, s, tx, ty)
      renderStroke(ctx, stroke); ctx.restore()
    }
    emit()
  }, [tool, getCtx, buildTransform, redrawCommitted, emit, syncSelectedIds, drawImageResizeHandles])

  // ── Text box operations ───────────────────────────────────────────────────

  const syncTextBoxes = useCallback((updated: TextBox[]) => {
    textBoxesRef.current = updated; setTextBoxes(updated); emit()
  }, [emit])

  const createTextBox = useCallback((clientX: number, clientY: number) => {
    const { x, y } = toWorld(clientX, clientY)
    const id = newId()
    const newBox: TextBox = {
      id, x, y, width: 200,
      html: '', blockType: textDefBlockType, fontSize: 16, align: textDefAlign,
    }
    setPendingFocusId(id)
    syncTextBoxes([...textBoxesRef.current, newBox])
    setFocusedBoxId(id)
  }, [toWorld, syncTextBoxes, textDefAlign, textDefBlockType])

  // ── Sticky note operations ────────────────────────────────────────────────

  const syncStickyNotes = useCallback((updated: StickyNote[]) => {
    stickyNotesRef.current = updated; setStickyNotes(updated); emit()
  }, [emit])

  const createStickyNote = useCallback((clientX: number, clientY: number) => {
    const { x, y } = toWorld(clientX, clientY)
    const id = newId()
    const newNote: StickyNote = {
      id, x, y, width: 180, height: 180, text: '',
      bgColor: stickyColor, fontSize: 14,
    }
    pendingStickyFocusRef.current = id
    syncStickyNotes([...stickyNotesRef.current, newNote])
    setFocusedStickyId(id)
  }, [stickyColor, toWorld, syncStickyNotes])

  const deleteFocusedSticky = useCallback(() => {
    if (!focusedStickyId) return
    const id = focusedStickyId; setFocusedStickyId(null)
    syncStickyNotes(stickyNotesRef.current.filter(n => n.id !== id))
  }, [focusedStickyId, syncStickyNotes])

  // ── Image upload ──────────────────────────────────────────────────────────

  const handleImageFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      setImagePreviewUrl(src)         // ← 미리보기 저장
      const el = new window.Image(); el.src = src
      el.onload = () => {
        const maxWidth = 400, ratio = el.height / el.width
        const w = Math.min(maxWidth, el.width), h = w * ratio
        const rect = committedRef.current?.getBoundingClientRect()
        const { x, y } = toWorld(rect ? rect.width / 2 : 200, rect ? rect.height / 2 : 200)
        const newImg: CanvasImage = { id: newId(), x: x - w / 2, y: y - h / 2, width: w, height: h, src }
        imageCache.current.set(newImg.id, el)
        imagesRef.current = [...imagesRef.current, newImg]
        // 업로드 후 자동 선택 → resize 핸들 표시
        selectedImageIdRef.current = newImg.id
        setSelectedImageId(newImg.id)
        redrawCommitted(); emit()
      }
    }
    reader.readAsDataURL(file); e.target.value = ''
  }, [toWorld, redrawCommitted, emit])

  // ── 크롭 조작 ────────────────────────────────────────────────────────────

  const startCrop = useCallback(() => {
    const imageId = selectedImageIdRef.current
    if (!imageId) return
    const img = imagesRef.current.find(i => i.id === imageId)
    if (!img) return
    const rect = { x: img.x, y: img.y, w: img.width, h: img.height }
    cropRectRef.current = rect
    setCropRect(rect)
    isCroppingRef.current = true   // 즉시 반영 (redrawCommitted 타이밍 보장)
    setIsCropping(true)
    drawCropOverlay(imageId, rect)
  }, [drawCropOverlay])

  const confirmCrop = useCallback(() => {
    const imageId = selectedImageIdRef.current
    const rect = cropRectRef.current
    if (!imageId || !rect) return
    const img = imagesRef.current.find(i => i.id === imageId)
    if (!img) return
    const imgEl = imageCache.current.get(imageId)
    if (!imgEl) return
    const scaleX = imgEl.naturalWidth / img.width
    const scaleY = imgEl.naturalHeight / img.height
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width  = Math.max(1, Math.round(rect.w * scaleX))
    tempCanvas.height = Math.max(1, Math.round(rect.h * scaleY))
    const tmpCtx = tempCanvas.getContext('2d')
    if (!tmpCtx) return
    tmpCtx.drawImage(
      imgEl,
      (rect.x - img.x) * scaleX, (rect.y - img.y) * scaleY,
      rect.w * scaleX, rect.h * scaleY,
      0, 0, tempCanvas.width, tempCanvas.height,
    )
    const newSrc = tempCanvas.toDataURL('image/png')
    const newEl = new window.Image()
    newEl.onload = () => {
      imageCache.current.set(imageId, newEl)
      imagesRef.current = imagesRef.current.map(i =>
        i.id === imageId ? { ...i, x: rect.x, y: rect.y, width: rect.w, height: rect.h, src: newSrc } : i
      )
      cropRectRef.current = null
      isCroppingRef.current = false  // 즉시 반영
      setCropRect(null)
      setIsCropping(false)
      cropDragRef.current = null
      setImagePreviewUrl(newSrc)
      redrawCommitted()
      emit()
      drawImageResizeHandles(imageId)
    }
    newEl.src = newSrc
  }, [redrawCommitted, emit, drawImageResizeHandles])

  const cancelCrop = useCallback(() => {
    isCroppingRef.current = false  // 즉시 반영
    setIsCropping(false)
    setCropRect(null)
    cropRectRef.current = null
    cropDragRef.current = null
    const ctx = getCtx(activeRef)
    if (ctx && activeRef.current) ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    if (selectedImageIdRef.current) drawImageResizeHandles(selectedImageIdRef.current)
  }, [getCtx, drawImageResizeHandles])

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop()
    if (prev !== undefined) {
      redoStackRef.current.push([...strokesRef.current])
      strokesRef.current = prev; redrawCommitted(); emit(); syncHistory()
    }
  }, [redrawCommitted, emit, syncHistory])

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop()
    if (next !== undefined) {
      undoStackRef.current.push([...strokesRef.current])
      strokesRef.current = next; redrawCommitted(); emit(); syncHistory()
    }
  }, [redrawCommitted, emit, syncHistory])

  // ── Zoom ──────────────────────────────────────────────────────────────────

  const applyZoom = useCallback((factor: number, cx: number, cy: number) => {
    const old = scaleRef.current
    scaleRef.current  = Math.min(4, Math.max(0.1, old * factor))
    offsetRef.current = {
      x: cx - (cx - offsetRef.current.x) * (scaleRef.current / old),
      y: cy - (cy - offsetRef.current.y) * (scaleRef.current / old),
    }
    redrawCommitted()
    if (scaleSpanRef.current)
      scaleSpanRef.current.textContent = `${Math.round(scaleRef.current * 100)}%`
  }, [redrawCommitted])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = committedRef.current?.getBoundingClientRect(); if (!rect) return
    if (e.ctrlKey || e.metaKey) {
      applyZoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - rect.left, e.clientY - rect.top)
    } else {
      offsetRef.current = { x: offsetRef.current.x - e.deltaX, y: offsetRef.current.y - e.deltaY }
      redrawCommitted()
    }
  }, [applyZoom, redrawCommitted])

  const zoomCenter = useCallback((factor: number) => {
    const rect = committedRef.current?.getBoundingClientRect(); if (!rect) return
    applyZoom(factor, rect.width / 2, rect.height / 2)
  }, [applyZoom])

  const handleFitView = useCallback(() => {
    const canvas = committedRef.current; if (!canvas) return
    const { width: vw, height: vh } = canvas.getBoundingClientRect()
    const allX: number[] = [], allY: number[] = []
    for (const s of strokesRef.current) for (const p of s.points) { allX.push(p.x); allY.push(p.y) }
    for (const img of imagesRef.current) {
      allX.push(img.x, img.x + img.width); allY.push(img.y, img.y + img.height)
    }
    for (const tb of textBoxesRef.current) {
      allX.push(tb.x, tb.x + tb.width + 150); allY.push(tb.y, tb.y + getBlockFontSize(tb) * 3)
    }
    for (const n of stickyNotesRef.current) {
      allX.push(n.x, n.x + n.width); allY.push(n.y, n.y + n.height)
    }
    if (allX.length === 0) {
      scaleRef.current = 1; offsetRef.current = { x: 0, y: 0 }
    } else {
      const pad = 48
      const minX = Math.min(...allX), maxX = Math.max(...allX)
      const minY = Math.min(...allY), maxY = Math.max(...allY)
      const cw = Math.max(maxX - minX, 1), ch = Math.max(maxY - minY, 1)
      const scale = Math.min(4, Math.max(0.1, Math.min((vw - pad * 2) / cw, (vh - pad * 2) / ch)))
      scaleRef.current = scale
      offsetRef.current = { x: (vw - cw * scale) / 2 - minX * scale, y: (vh - ch * scale) / 2 - minY * scale }
    }
    redrawCommitted()
    if (scaleSpanRef.current)
      scaleSpanRef.current.textContent = `${Math.round(scaleRef.current * 100)}%`
  }, [redrawCommitted])

  // ── Container click ────────────────────────────────────────────────────────

  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (tool === 'text') {
      // blur → 재렌더(focusedBoxId=null) → click 순으로 실행되면, mousedown 시점의 ref로 새 박스 생성을 막음
      if (!focusedBoxId && !hadFocusedBoxOnMouseDownRef.current) createTextBox(e.clientX, e.clientY)
    } else if (tool === 'sticky') {
      if (!focusedStickyId && !hadFocusedStickyOnMouseDownRef.current) createStickyNote(e.clientX, e.clientY)
    }
  }, [tool, focusedBoxId, focusedStickyId, createTextBox, createStickyNote])

  // ── 카테고리 클릭 ─────────────────────────────────────────────────────────

  const handleCategoryClick = useCallback((cat: Category | 'image') => {
    if (cat === 'image') {
      setTool('image')
      if (!imagePreviewUrlRef.current) imageInputRef.current?.click()
      return
    }
    if (cat === 'text')        { setTool('text'); setActiveCategory(null); return }
    if (cat === 'pen')         setTool('pen')
    if (cat === 'eraser')      setTool('eraser')
    if (cat === 'highlighter') setTool('highlighter')
    if (cat === 'sticky')      setTool('sticky')
    if (cat === 'select')      setTool('select')
    if (cat === 'shapes')      setTool('shapes')
    setActiveCategory(prev => prev === cat ? null : cat as Category)
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // e.code 사용 → 한/영 입력 모드에 무관하게 물리 키 위치 기준으로 동작

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inInput = focusedBoxId !== null || focusedStickyId !== null
      const code = e.code  // 물리 키 위치 (한영 독립)

      // ── ⌘/Ctrl 조합 ───────────────────────────────────────────────────────
      if ((e.metaKey || e.ctrlKey) && code === 'KeyZ' && !e.shiftKey) { e.preventDefault(); handleUndo(); return }
      if ((e.metaKey || e.ctrlKey) && (code === 'KeyY' || (code === 'KeyZ' && e.shiftKey))) { e.preventDefault(); handleRedo(); return }
      if (e.metaKey || e.ctrlKey || e.altKey) return  // 나머지 메타 조합 무시

      // ── Space: 임시 패닝 (인풋 포커스 중엔 무시) ──────────────────────────
      if (code === 'Space' && !inInput) {
        if (!e.repeat && prevToolBeforeSpaceRef.current === null) {
          e.preventDefault()
          prevToolBeforeSpaceRef.current = toolRef.current
          setTool('pan')
        }
        return
      }

      if (inInput) return  // 텍스트/포스트잇 편집 중엔 이하 단축키 무시

      // ── 툴 선택 ───────────────────────────────────────────────────────────
      if (code === 'KeyV') handleCategoryClick('select')
      if (code === 'KeyP') handleCategoryClick('pen')
      if (code === 'KeyE') handleCategoryClick('eraser')
      if (code === 'KeyH') handleCategoryClick('highlighter')
      if (code === 'KeyT') handleCategoryClick('text')
      if (code === 'KeyS') handleCategoryClick('sticky')
      if (code === 'KeyG') handleCategoryClick('shapes')
      if (code === 'KeyI') { e.preventDefault(); imageInputRef.current?.click() }

      // ── 뷰 조작 ───────────────────────────────────────────────────────────
      if (code === 'KeyF') { e.preventDefault(); handleFitView() }
      if (code === 'Equal' || code === 'NumpadAdd')      { e.preventDefault(); zoomCenter(1.25) }
      if (code === 'Minus' || code === 'NumpadSubtract') { e.preventDefault(); zoomCenter(0.8)  }

      // ── 펜/지우개 굵기 ────────────────────────────────────────────────────
      if (code === 'BracketLeft')  setPenWidth(prev => { const i = WIDTHS.indexOf(prev); return i > 0 ? WIDTHS[i - 1] : prev })
      if (code === 'BracketRight') setPenWidth(prev => { const i = WIDTHS.indexOf(prev); return i < WIDTHS.length - 1 ? WIDTHS[i + 1] : prev })

      // ── Escape: 선택 해제 + 서브패널 닫기 ────────────────────────────────
      if (code === 'Escape') {
        setOpenSubPanel(null)
        if (selectedItemsRef.current.length > 0) {
          selectedItemsRef.current = []; selectDragRef.current = null
          rubberBandRef.current = null; syncSelectedIds(); redrawCommitted()
        }
      }

      // ── Delete / Backspace: 선택 항목 삭제 (다중 지원) ───────────────────
      if ((code === 'Delete' || code === 'Backspace') && toolRef.current === 'select' && selectedItemsRef.current.length > 0) {
        e.preventDefault()
        const toDelete = selectedItemsRef.current
        selectedItemsRef.current = []; selectDragRef.current = null; syncSelectedIds()
        const strokeIds  = new Set(toDelete.filter(i => i.type === 'stroke' ).map(i => i.id))
        const imageIds   = new Set(toDelete.filter(i => i.type === 'image'  ).map(i => i.id))
        const textboxIds = new Set(toDelete.filter(i => i.type === 'textbox').map(i => i.id))
        const stickyIds  = new Set(toDelete.filter(i => i.type === 'sticky' ).map(i => i.id))
        if (strokeIds.size > 0) {
          undoStackRef.current.push([...strokesRef.current]); redoStackRef.current = []
          strokesRef.current = strokesRef.current.filter(s => !strokeIds.has(s.id))
          syncHistory()
        }
        if (imageIds.size > 0) {
          imagesRef.current = imagesRef.current.filter(img => !imageIds.has(img.id))
          imageIds.forEach(id => imageCache.current.delete(id))
        }
        if (textboxIds.size > 0) syncTextBoxes(textBoxesRef.current.filter(tb => !textboxIds.has(tb.id)))
        if (stickyIds.size > 0)  syncStickyNotes(stickyNotesRef.current.filter(n => !stickyIds.has(n.id)))
        redrawCommitted(); emit()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      // Space 해제 → 이전 툴로 복귀
      if (e.code === 'Space' && prevToolBeforeSpaceRef.current !== null) {
        setTool(prevToolBeforeSpaceRef.current)
        prevToolBeforeSpaceRef.current = null
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [handleUndo, handleRedo, handleFitView, zoomCenter, handleCategoryClick,
      focusedBoxId, focusedStickyId,
      redrawCommitted, emit, syncTextBoxes, syncStickyNotes, syncHistory, syncSelectedIds])

  // ── 툴 전환 시 선택 해제 ──────────────────────────────────────────────────

  useEffect(() => {
    if (tool !== 'select') {
      const needsRedraw = selectedItemsRef.current.length > 0 || !!rubberBandRef.current
      selectedItemsRef.current = []; selectDragRef.current = null; rubberBandRef.current = null
      syncSelectedIds()
      // rubber-band는 active 캔버스에 그려지므로, select 툴을 벗어날 때 항상 지움
      const ctx = activeRef.current?.getContext('2d')
      if (ctx && activeRef.current) ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
      if (needsRedraw) redrawCommitted()
    }
    // shapes 도구 벗어날 때 선택된 도형 해제
    if (tool !== 'shapes' && selectedShapeIdRef.current) {
      selectedShapeIdRef.current = null
      setSelectedShapeId(null)
      shapeResizeRef.current = null
      const ctx = activeRef.current?.getContext('2d')
      if (ctx && activeRef.current) ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    }
    // image 도구 벗어날 때 선택된 이미지 해제 + 크롭 종료
    if (tool !== 'image' && selectedImageIdRef.current) {
      selectedImageIdRef.current = null
      setSelectedImageId(null)
      imageResizeRef.current = null; imageMoveRef.current = null
      if (isCroppingRef.current) {
        isCroppingRef.current = false
        setIsCropping(false); setCropRect(null)
        cropRectRef.current = null; cropDragRef.current = null
      }
      const ctx = activeRef.current?.getContext('2d')
      if (ctx && activeRef.current) ctx.clearRect(0, 0, activeRef.current.width, activeRef.current.height)
    }
  }, [tool, redrawCommitted, syncSelectedIds])

  // ── 카테고리 ↔ 툴 동기화 ─────────────────────────────────────────────────

  useEffect(() => {
    if (tool === 'pan' || tool === 'select') setActiveCategory('select')
    else if (tool === 'pen')         setActiveCategory('pen')
    else if (tool === 'eraser')      setActiveCategory('eraser')
    else if (tool === 'highlighter') setActiveCategory('highlighter')
    else if (tool === 'sticky')      setActiveCategory('sticky')
    else if (tool === 'text' || tool === 'image' || tool === 'shapes') setActiveCategory(null)
  }, [tool])

  // ── 텍스트박스 포커스 시 텍스트 세부패널 자동 오픈 ──────────────────────
  useEffect(() => {
    if (focusedBoxId) setOpenSubPanel('text')
  }, [focusedBoxId])

  // ── Sub-components ────────────────────────────────────────────────────────

  const ToolBtn = ({
    icon: Icon, active, onClick, title, disabled, rounded = 'rounded-md', compact = false,
  }: {
    icon: React.ComponentType<{ className?: string }>
    active?: boolean; onClick: () => void; title: string; disabled?: boolean
    rounded?: string; compact?: boolean
  }) => (
    <button
      onClick={onClick} title={title} disabled={disabled}
      className={cn(
        compact ? 'w-8 h-8' : 'w-9 h-9',
        'flex items-center justify-center transition-colors',
        rounded,
        active   ? 'bg-primary/15 text-primary' : 'text-foreground/70 hover:text-foreground hover:bg-muted/80',
        disabled && 'opacity-30 cursor-default'
      )}
    >
      <Icon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    </button>
  )

  // self-stretch → 플렉스 컨테이너 너비에 맞게 자동 확장
  const Sep = () => <div className="h-px self-stretch bg-border/70 my-0.5 flex-shrink-0" />

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full flex flex-col">
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative select-none canvas-dot-grid"
        onMouseDown={() => {
          // click보다 mousedown이 먼저 실행 → blur 전 상태를 기록
          hadFocusedBoxOnMouseDownRef.current    = !!focusedBoxId
          hadFocusedStickyOnMouseDownRef.current = !!focusedStickyId
          // 포커스된 포스트잇이 비어있으면 즉시 삭제 (onBlur가 안 오는 경우 대비)
          if (focusedStickyId) {
            const n = stickyNotesRef.current.find(n => n.id === focusedStickyId)
            if (n && !(n.text || '').trim()) {
              setFocusedStickyId(null)
              syncStickyNotes(stickyNotesRef.current.filter(s => s.id !== focusedStickyId))
            }
          }
        }}
        onClick={handleContainerClick}
        onWheel={onWheel}
      >
        <canvas ref={committedRef} className="absolute inset-0" />

        {/* Text boxes + Sticky notes overlay */}
        <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: 'none' }}>
          <div ref={transformLayerRef} style={{ position: 'absolute', top: 0, left: 0, transformOrigin: '0 0' }}>

            {/* ── Text boxes (TipTap 기반 TextBlockEditor) ── */}
            {textBoxes.map((box) => (
              <TextBlockEditor
                key={box.id}
                box={box}
                isFocused={focusedBoxId === box.id}
                isSelected={selectedIds.has(box.id)}
                tool={tool}
                pendingFocus={pendingFocusId === box.id}
                onEditorReady={(editor) => { focusedEditorRef.current = editor }}
                onFocus={() => setFocusedBoxId(box.id)}
                onBlur={(html, isEmpty) => {
                  setFocusedBoxId(null)
                  setPendingFocusId(null)
                  setCurrentFormat({ bold: false, italic: false, underline: false, strike: false })
                  setCurrentBlockType('p')
                  setCurrentAlign('left')
                  if (isEmpty) {
                    syncTextBoxes(textBoxesRef.current.filter(tb => tb.id !== box.id))
                  } else {
                    textBoxesRef.current = textBoxesRef.current.map(tb =>
                      tb.id === box.id ? { ...tb, html } : tb
                    )
                    setTextBoxes([...textBoxesRef.current]); emit()
                  }
                }}
                onHtmlChange={(html) => {
                  textBoxesRef.current = textBoxesRef.current.map(tb =>
                    tb.id === box.id ? { ...tb, html } : tb
                  )
                  emit()
                }}
                onGripPointerDown={(e, boxId) => {
                  const { x: startWx, y: startWy } = toWorld(e.clientX, e.clientY)
                  const origBox = textBoxesRef.current.find(tb => tb.id === boxId)
                  if (!origBox) return
                  const origX = origBox.x, origY = origBox.y
                  let hasMoved = false
                  const isShift = e.shiftKey

                  const onMove = (ev: PointerEvent) => {
                    const { x: wx, y: wy } = toWorld(ev.clientX, ev.clientY)
                    const dx = wx - startWx, dy = wy - startWy
                    if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) hasMoved = true
                    if (!hasMoved) return
                    textBoxesRef.current = textBoxesRef.current.map(tb =>
                      tb.id === boxId ? { ...tb, x: origX + dx, y: origY + dy } : tb
                    )
                    setTextBoxes([...textBoxesRef.current])
                    redrawCommitted()
                  }

                  const onUp = () => {
                    window.removeEventListener('pointermove', onMove)
                    window.removeEventListener('pointerup', onUp)
                    if (hasMoved) {
                      emit()
                    } else {
                      // 클릭으로 간주
                      if (toolRef.current === 'text') {
                        setFocusedBoxId(boxId)
                      } else if (toolRef.current === 'select') {
                        const hitItem: SelectItem = { type: 'textbox', id: boxId }
                        const alreadySelected = selectedItemsRef.current.some(i => i.id === boxId)
                        if (isShift) {
                          selectedItemsRef.current = alreadySelected
                            ? selectedItemsRef.current.filter(i => i.id !== boxId)
                            : [...selectedItemsRef.current, hitItem]
                        } else {
                          selectedItemsRef.current = [hitItem]
                        }
                        syncSelectedIds()
                        redrawCommitted()
                      }
                    }
                  }

                  window.addEventListener('pointermove', onMove)
                  window.addEventListener('pointerup', onUp)
                }}
                onPendingFocusResolved={() => setPendingFocusId(null)}
                onBlockTypeChange={(bt) => {
                  setCurrentBlockType(bt)
                  textBoxesRef.current = textBoxesRef.current.map(tb =>
                    tb.id === box.id ? { ...tb, blockType: bt } : tb
                  )
                }}
                onAlignChange={(al) => setCurrentAlign(al)}
                onFormatChange={(f) => setCurrentFormat(f)}
              />
            ))}

            {/* ── Sticky notes (헤더 없는 심플형, 다크모드 지원) ── */}
            {stickyNotes.map((note) => {
              const isFocused = focusedStickyId === note.id
              return (
                <div
                  key={note.id}
                  style={{
                    position: 'absolute', left: note.x, top: note.y,
                    width: note.width, height: note.height,
                    pointerEvents: 'auto',
                    borderRadius: 8,
                    background: note.bgColor,
                    boxShadow: isFocused
                      ? '0 6px 20px rgba(0,0,0,0.22)'
                      : '0 2px 10px rgba(0,0,0,0.14)',
                    outline: isFocused
                      ? '2px solid rgba(99,102,241,0.55)'
                      : '2px solid transparent',
                    overflow: 'hidden',
                    cursor: tool === 'sticky' ? 'grab' : tool === 'select' ? 'move' : 'default',
                    display: 'flex', flexDirection: 'column',
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    if (tool !== 'sticky') return
                    // textarea 또는 버튼 클릭 시 드래그 시작 안함
                    const tag = (e.target as HTMLElement).tagName
                    if (tag === 'TEXTAREA' || tag === 'BUTTON') return
                    e.stopPropagation()
                    const { x: startWx, y: startWy } = toWorld(e.clientX, e.clientY)
                    const origX = stickyNotesRef.current.find(n => n.id === note.id)?.x ?? note.x
                    const origY = stickyNotesRef.current.find(n => n.id === note.id)?.y ?? note.y
                    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
                    const onMove = (ev: PointerEvent) => {
                      const { x: wx, y: wy } = toWorld(ev.clientX, ev.clientY)
                      stickyNotesRef.current = stickyNotesRef.current.map(n =>
                        n.id === note.id ? { ...n, x: origX + (wx - startWx), y: origY + (wy - startWy) } : n
                      )
                      setStickyNotes([...stickyNotesRef.current])
                    }
                    const onUp = () => {
                      emit()
                      window.removeEventListener('pointermove', onMove)
                      window.removeEventListener('pointerup', onUp)
                    }
                    window.addEventListener('pointermove', onMove)
                    window.addEventListener('pointerup', onUp)
                  }}
                >
                  {/* 삭제 버튼 (포커스시만) */}
                  {isFocused && (
                    <div style={{ position: 'absolute', top: 4, right: 6, zIndex: 1 }}>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                        onClick={(e) => { e.stopPropagation(); deleteFocusedSticky() }}
                        style={{
                          background: 'rgba(0,0,0,0.12)', border: 'none',
                          borderRadius: '50%', width: 20, height: 20,
                          cursor: 'pointer', fontSize: 14, lineHeight: 1,
                          color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="삭제"
                      >×</button>
                    </div>
                  )}
                  <textarea
                    ref={(el) => {
                      if (el && pendingStickyFocusRef.current === note.id) {
                        el.focus(); pendingStickyFocusRef.current = null
                      }
                    }}
                    value={note.text}
                    placeholder={isFocused ? '메모 입력...' : ''}
                    onChange={(e) => {
                      const updated = stickyNotesRef.current.map(n =>
                        n.id === note.id ? { ...n, text: e.target.value } : n
                      )
                      stickyNotesRef.current = updated; setStickyNotes(updated); emit()
                    }}
                    onFocus={() => setFocusedStickyId(note.id)}
                    onBlur={() => {
                      setFocusedStickyId(null)
                      // 내용 없이 blur → 빈 유령 포스트잇 자동 삭제
                      if (!note.text.trim()) {
                        syncStickyNotes(stickyNotesRef.current.filter(n => n.id !== note.id))
                      }
                    }}
                    style={{
                      flex: 1, resize: 'none', background: 'transparent',
                      border: 'none', outline: 'none',
                      padding: '28px 12px 12px',  // top padding for × button space
                      fontSize: note.fontSize, fontFamily: 'inherit',
                      color: isDark ? '#f5f5f5' : '#1a1a1a',
                      lineHeight: 1.6, cursor: 'text',
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Active strokes canvas */}
        <canvas
          ref={activeRef}
          className="absolute inset-0 touch-none"
          style={{
            cursor:
              tool === 'eraser'  ? 'cell'      :
              tool === 'text'    ? (focusedBoxId ? 'default' : 'text') :
              tool === 'pan'     ? 'grab'       :
              tool === 'select'  ? 'crosshair'  :
              tool === 'image'   ? 'default'    :
              'crosshair',
            pointerEvents: (tool === 'text' || tool === 'sticky') ? 'none' : 'auto',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {/* 줌 컨트롤 */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col items-center gap-0.5 px-1.5 py-2 bg-background/95 backdrop-blur-sm border border-border rounded-2xl shadow-lg" onClick={(e) => e.stopPropagation()}>
          <ToolBtn icon={ZoomIn}  onClick={() => zoomCenter(1.25)} title="확대 (+)" />
          <span ref={scaleSpanRef} className="text-xs text-muted-foreground/50 w-9 text-center select-none my-1">100%</span>
          <ToolBtn icon={ZoomOut} onClick={() => zoomCenter(0.8)}  title="축소 (−)" />
          <Sep />
          <ToolBtn icon={Maximize2} onClick={handleFitView} title="한눈에 보기 (F)" />
        </div>
      </div>

      {/* ── Floating toolbar (우측 수직, 상단 고정) ──────────────────────── */}
      <div className="absolute top-4 right-4 z-20 pointer-events-none flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {/* ── 메인 툴바 pill (항상 드로잉 툴) ── */}
        <motion.div
          layout
          transition={{ layout: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }}
          className="pointer-events-auto flex flex-col items-center gap-0.5 px-1.5 py-2 bg-background/95 backdrop-blur-sm border border-border rounded-2xl shadow-lg"
          onMouseDown={(focusedStickyId || focusedBoxId) ? (e) => e.preventDefault() : undefined}
        >
              {/* Select */}
              <ToolBtn
                icon={SquareDashedMousePointer}
                active={tool === 'select'}
                onClick={() => { handleCategoryClick('select'); setOpenSubPanel(null) }}
                title="선택 (V)  |  Space 길게 누르면 임시 이동"
              />

              {/* ── Pen ──────────────────────────────────────────────────────── */}
              <ToolBtn
                icon={Pen}
                active={tool === 'pen'}
                onClick={() => { handleCategoryClick('pen'); setOpenSubPanel(null) }}
                title="펜 (P)"
              />

              {/* ── Eraser ───────────────────────────────────────────────────── */}
              <ToolBtn
                icon={Eraser}
                active={tool === 'eraser'}
                onClick={() => { handleCategoryClick('eraser'); setOpenSubPanel(null) }}
                title="지우개 (E)"
              />

              {/* ── Highlighter ──────────────────────────────────────────────── */}
              <ToolBtn
                icon={Highlighter}
                active={tool === 'highlighter'}
                onClick={() => { handleCategoryClick('highlighter'); setOpenSubPanel(null) }}
                title="형광펜 (H)"
              />

              <Sep />

              {/* Text */}
              <ToolBtn
                icon={Type}
                active={tool === 'text'}
                onClick={() => { handleCategoryClick('text'); setOpenSubPanel(null) }}
                title="텍스트 (T)"
              />

              {/* ── Sticky ───────────────────────────────────────────────────── */}
              <ToolBtn
                icon={StickyNoteIcon}
                active={tool === 'sticky'}
                onClick={() => { handleCategoryClick('sticky'); setOpenSubPanel(null) }}
                title="포스트잇 (S)"
              />

              {/* Shapes */}
              <ToolBtn
                icon={Shapes}
                active={tool === 'shapes'}
                onClick={() => { handleCategoryClick('shapes'); setOpenSubPanel(null) }}
                title="도형 (G)"
              />

              {/* Image */}
              <ToolBtn
                icon={ImagePlus}
                active={tool === 'image'}
                onClick={() => {
                  if (tool === 'image') {
                    // 이미 이미지 모드: 파일 다이얼로그 열어 추가 이미지 업로드
                    imageInputRef.current?.click()
                  } else {
                    handleCategoryClick('image')
                    setOpenSubPanel(null)
                  }
                }}
                title="이미지 (I)"
              />

              <Sep />

              {/* ── 공통 세부설정 슬롯: 도구 선택 시 항상 이 위치에 표시 ── */}
              <div className="relative">
                {/* 지시자 버튼 — 도구 전환 시 애니메이션 */}
                <AnimatePresence>
                  {(tool === 'pen' || tool === 'eraser' || tool === 'highlighter' || tool === 'sticky' || tool === 'select' || tool === 'shapes' || tool === 'image' || tool === 'text') && (
                    <motion.div
                      key="sub-slot"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 36, opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <button
                        onClick={() => {
                          if (tool === 'pen')              setOpenSubPanel(p => p === 'pen'         ? null : 'pen')
                          else if (tool === 'eraser')      setOpenSubPanel(p => p === 'eraser'      ? null : 'eraser')
                          else if (tool === 'highlighter') setOpenSubPanel(p => p === 'highlighter' ? null : 'highlighter')
                          else if (tool === 'sticky')      setOpenSubPanel(p => p === 'sticky'      ? null : 'sticky')
                          else if (tool === 'select')      setOpenSubPanel(p => p === 'select'      ? null : 'select')
                          else if (tool === 'shapes')      setOpenSubPanel(p => p === 'shapes'      ? null : 'shapes')
                          else if (tool === 'image') {
                            setOpenSubPanel(p => p === 'image' ? null : 'image')
                          }
                          else if (tool === 'text') setOpenSubPanel(p => p === 'text' ? null : 'text')
                        }}
                        className={cn(
                          'w-9 h-9 flex items-center justify-center rounded-md transition-colors overflow-hidden',
                          openSubPanel ? 'bg-primary/22' : 'bg-primary/12'
                        )}
                        title="세부 설정"
                      >
                        {tool === 'pen' && (
                          <div className="rounded-full flex-shrink-0" style={{ width: Math.round(8 + ((penWidth - 2) / 14) * 10), height: Math.round(8 + ((penWidth - 2) / 14) * 10), background: penColor, boxShadow: '0 0 0 1.5px rgba(0,0,0,0.12)' }} />
                        )}
                        {tool === 'eraser' && (
                          <div className="rounded-full flex-shrink-0 border border-foreground/50" style={{ width: Math.max(4, Math.round(3 + (penWidth / 16) * 8)), height: Math.max(4, Math.round(3 + (penWidth / 16) * 8)) }} />
                        )}
                        {tool === 'highlighter' && (
                          <div className="rounded-full flex-shrink-0" style={{ width: 16, height: 16, background: hlColor, opacity: 0.85 }} />
                        )}
                        {tool === 'sticky' && (
                          <div className="flex-shrink-0" style={{ width: 14, height: 14, background: stickyColor, borderRadius: 3 }} />
                        )}
                        {tool === 'select' && (
                          selectMode === 'lasso'
                            ? <Lasso className="w-4 h-4 text-primary" />
                            : <BoxSelect className="w-4 h-4 text-primary" />
                        )}
                        {tool === 'shapes' && (
                          shapeType === 'circle' ? <Circle className="w-4 h-4 text-primary" /> :
                          shapeType === 'star'   ? <Star   className="w-4 h-4 text-primary" /> :
                          shapeType === 'line'   ? <Minus  className="w-4 h-4 text-primary" /> :
                                                   <Square className="w-4 h-4 text-primary" />
                        )}
                        {tool === 'image' && (
                          imagePreviewUrl
                            ? <img src={imagePreviewUrl} alt="미리보기" className="w-full h-full object-cover" />
                            : <ImageIcon className="w-4 h-4 text-primary opacity-70" />
                        )}
                        {tool === 'text' && (
                          <span
                            style={{
                              fontSize: textDefBlockType !== 'p' ? 14 : 13,
                              fontWeight: textDefBlockType !== 'p' ? 'bold' : 'normal',
                              lineHeight: 1,
                              userSelect: 'none',
                            }}
                          >
                            {textDefBlockType === 'h1' ? 'H¹' : textDefBlockType === 'h2' ? 'H²' : textDefBlockType === 'h3' ? 'H³' : 'T'}
                          </span>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 플로팅 패널 — 공통 슬롯 기준 좌측 배치 */}
                <AnimatePresence>
                  {openSubPanel === 'pen' && (
                    <motion.div
                      key="pen-float"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-full bottom-0 mr-2 flex flex-col gap-2 p-2.5 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl z-30"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {/* 색상 — 원형 컬러 피커 */}
                      <div className="flex items-center gap-2">
                        {(isDark ? PEN_COLORS_DARK : PEN_COLORS_LIGHT).map((c, i) => (
                          <button key={i} onClick={() => setPenColorIdx(i)}
                            title={['기본', '빨강', '파랑'][i]}
                            className={cn('w-6 h-6 rounded-full transition-transform hover:scale-110 ring-offset-1',
                              penColorIdx === i ? 'ring-2 ring-primary scale-110' : 'ring-1 ring-black/10'
                            )}
                            style={{ background: c }} />
                        ))}
                      </div>
                      <div className="h-px bg-border/60" />
                      {/* 굵기 — 도트 크기 */}
                      <div className="flex items-center gap-0.5">
                        {WIDTHS.map((w) => (
                          <button key={w} onClick={() => setPenWidth(w)}
                            title={`굵기 ${w}`}
                            className={cn('w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                              penWidth === w
                                ? 'bg-primary/12 hover:bg-primary/20'
                                : 'hover:bg-muted/80'
                            )}>
                            <div className="rounded-full" style={{ width: Math.min(w, 14), height: Math.min(w, 14), background: penColorIdx === 0 ? (isDark ? '#e5e7eb' : '#1a1a1a') : (isDark ? PEN_COLORS_DARK : PEN_COLORS_LIGHT)[penColorIdx] }} />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {openSubPanel === 'eraser' && (
                    <motion.div
                      key="eraser-float"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-full bottom-0 mr-2 flex items-center gap-0.5 p-2 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl z-30"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {WIDTHS.map((w) => (
                        <button key={w} onClick={() => setPenWidth(w)}
                          title={`지우개 크기 ${w}`}
                          className={cn('w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                            penWidth === w
                              ? 'bg-primary/12 hover:bg-primary/20'
                              : 'hover:bg-muted/80'
                          )}>
                          <div className="rounded-full border border-foreground/35 bg-foreground/5" style={{ width: Math.min(w + 3, 18), height: Math.min(w + 3, 18) }} />
                        </button>
                      ))}
                    </motion.div>
                  )}
                  {openSubPanel === 'highlighter' && (
                    <motion.div
                      key="hl-float"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-full bottom-0 mr-2 flex flex-col gap-1 p-2 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl z-30 min-w-[130px]"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {(isDark ? HL_COLORS_DARK : HL_COLORS_LIGHT).map((c, i) => (
                        <button key={i} onClick={() => setHlColorIdx(i)}
                          className={cn('flex items-center gap-2.5 px-2 py-2 rounded-md text-xs transition-colors',
                            hlColorIdx === i ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/70 hover:text-foreground hover:bg-muted/80'
                          )}>
                          <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 ring-1 ring-black/10" style={{ background: c, opacity: 0.9 }} />
                          {['핑크', '노랑', '하늘'][i]}
                        </button>
                      ))}
                    </motion.div>
                  )}
                  {openSubPanel === 'sticky' && (
                    <motion.div
                      key="sticky-float"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-full bottom-0 mr-2 flex flex-col gap-1 p-2 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl z-30 min-w-[130px]"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {currentStickyColors.map((c, i) => (
                        <button key={c} onClick={() => setStickyColor(c)}
                          className={cn('flex items-center gap-2.5 px-2 py-2 rounded-md text-xs transition-colors',
                            stickyColor === c ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/70 hover:text-foreground hover:bg-muted/80'
                          )}>
                          <div className="w-3.5 h-3.5 rounded flex-shrink-0 ring-1 ring-black/10" style={{ background: c }} />
                          {['노랑', '핑크', '민트', '하늘', '라벤더', '주황'][i]}
                        </button>
                      ))}
                    </motion.div>
                  )}
                  {openSubPanel === 'select' && (
                    <motion.div
                      key="select-float"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-full bottom-0 mr-2 flex flex-col gap-1 p-2 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl z-30 min-w-[130px]"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setSelectMode('rect'); setOpenSubPanel(null) }}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                          selectMode === 'rect'
                            ? 'bg-primary/15 text-primary font-medium'
                            : 'text-foreground/70 hover:text-foreground hover:bg-muted/80'
                        )}
                      >
                        <BoxSelect className="w-3.5 h-3.5 flex-shrink-0" />
                        사각 드래그
                      </button>
                      <button
                        onClick={() => { setSelectMode('lasso'); setOpenSubPanel(null) }}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                          selectMode === 'lasso'
                            ? 'bg-primary/15 text-primary font-medium'
                            : 'text-foreground/70 hover:text-foreground hover:bg-muted/80'
                        )}
                      >
                        <Lasso className="w-3.5 h-3.5 flex-shrink-0" />
                        올가미
                      </button>
                    </motion.div>
                  )}
                  {openSubPanel === 'text' && (
                    <motion.div
                      key="text-float"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-full bottom-0 mr-2 flex flex-col gap-2 p-2.5 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl z-30"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {/* ── 블록 타입: T / H1 / H2 / H3 ── */}
                      <div className="flex items-center gap-0.5">
                        {(['p', 'h1', 'h2', 'h3'] as const).map((bt) => {
                          const isHeading = bt !== 'p'
                          const disabledWhenNoFocus = isHeading && !focusedBoxId
                          return (
                            <button
                              key={bt}
                              disabled={disabledWhenNoFocus}
                              onClick={() => {
                                if (focusedBoxId && focusedEditorRef.current) {
                                  const ed = focusedEditorRef.current
                                  if (bt === 'p') ed.chain().focus().setParagraph().run()
                                  else ed.chain().focus().setHeading({ level: bt === 'h1' ? 1 : bt === 'h2' ? 2 : 3 }).run()
                                  setCurrentBlockType(bt)
                                } else if (!isHeading) {
                                  setTextDefBlockType(bt)
                                }
                              }}
                              className={cn(
                                'h-8 px-2 text-xs rounded-md transition-colors',
                                disabledWhenNoFocus
                                  ? 'opacity-30 cursor-not-allowed text-foreground/40'
                                  : (focusedBoxId ? currentBlockType : textDefBlockType) === bt
                                    ? 'bg-primary/15 text-primary font-semibold'
                                    : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'
                              )}
                            >
                              {bt === 'p' ? 'T' : bt.toUpperCase()}
                            </button>
                          )
                        })}
                      </div>
                      <div className="h-px bg-border/60" />
                      {/* ── 정렬 ── */}
                      <div className="flex items-center gap-0.5">
                        {([
                          { icon: AlignLeft,   val: 'left'   as const },
                          { icon: AlignCenter, val: 'center' as const },
                          { icon: AlignRight,  val: 'right'  as const },
                        ] as const).map(({ icon: Icon, val }) => (
                          <button
                            key={val}
                            onClick={() => {
                              if (focusedBoxId && focusedEditorRef.current) {
                                focusedEditorRef.current.chain().focus().setTextAlign(val).run()
                                setCurrentAlign(val)
                              } else {
                                setTextDefAlign(val)
                              }
                            }}
                            className={cn('w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                              (focusedBoxId ? currentAlign : textDefAlign) === val
                                ? 'bg-primary/15 text-primary'
                                : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                      <div className="h-px bg-border/60" />
                      {/* ── 서식: 굵게 / 기울임 / 밑줄 / 취소선 — 포커스 시 활성 ── */}
                      <div className={cn('flex items-center gap-0.5', !focusedBoxId && 'opacity-35 pointer-events-none')}>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const ed = focusedEditorRef.current; if (!ed) return
                            ed.chain().focus().toggleBold().run()
                            setCurrentFormat({ bold: ed.isActive('bold'), italic: ed.isActive('italic'), underline: ed.isActive('underline'), strike: ed.isActive('strike') })
                          }}
                          className={cn('w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                            currentFormat.bold
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground/70 hover:text-foreground hover:bg-muted/80'
                          )} title="굵게">
                          <Bold className="w-4 h-4" />
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const ed = focusedEditorRef.current; if (!ed) return
                            ed.chain().focus().toggleItalic().run()
                            setCurrentFormat({ bold: ed.isActive('bold'), italic: ed.isActive('italic'), underline: ed.isActive('underline'), strike: ed.isActive('strike') })
                          }}
                          className={cn('w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                            currentFormat.italic
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground/70 hover:text-foreground hover:bg-muted/80'
                          )} title="기울임">
                          <Italic className="w-4 h-4" />
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const ed = focusedEditorRef.current; if (!ed) return
                            ed.chain().focus().toggleUnderline().run()
                            setCurrentFormat({ bold: ed.isActive('bold'), italic: ed.isActive('italic'), underline: ed.isActive('underline'), strike: ed.isActive('strike') })
                          }}
                          className={cn('w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                            currentFormat.underline
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground/70 hover:text-foreground hover:bg-muted/80'
                          )} title="밑줄">
                          <UnderlineIcon className="w-4 h-4" />
                        </button>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const ed = focusedEditorRef.current; if (!ed) return
                            ed.chain().focus().toggleStrike().run()
                            setCurrentFormat({ bold: ed.isActive('bold'), italic: ed.isActive('italic'), underline: ed.isActive('underline'), strike: ed.isActive('strike') })
                          }}
                          className={cn('w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                            currentFormat.strike
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground/70 hover:text-foreground hover:bg-muted/80'
                          )} title="취소선">
                          <Strikethrough className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="h-px bg-border/60" />
                      {/* ── 색상 팔레트 — 포커스 시 활성 ── */}
                      <div className={cn('flex items-center gap-1.5 px-0.5', !focusedBoxId && 'opacity-35 pointer-events-none')}>
                        {['#1a1a1a', '#dc2626', '#2563eb'].map((c) => (
                          <button
                            key={c} title={c}
                            onClick={() => focusedEditorRef.current?.chain().focus().setColor(c).run()}
                            className="w-5 h-5 rounded-full transition-transform hover:scale-110 ring-1 ring-black/10 flex-shrink-0"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                  {openSubPanel === 'image' && (
                    <motion.div
                      key="image-float"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-full bottom-0 mr-2 flex flex-col gap-1 p-2 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl z-30 min-w-[160px]"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {selectedImageId ? (
                        /* 이미지 선택됨 — 미리보기 + 크롭 버튼 */
                        <>
                          {imagePreviewUrl && (
                            <div className="w-full h-24 rounded-lg overflow-hidden border border-border mb-1">
                              <img src={imagePreviewUrl} alt="미리보기" className="w-full h-full object-cover" />
                            </div>
                          )}
                          {isCropping ? (
                            <>
                              <button
                                onClick={confirmCrop}
                                className="flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors text-primary font-medium hover:bg-primary/10"
                              >
                                <Crop className="w-3.5 h-3.5 flex-shrink-0" />
                                크롭 적용
                              </button>
                              <button
                                onClick={cancelCrop}
                                className="flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors text-foreground/60 hover:text-foreground hover:bg-muted/80"
                              >
                                <XIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={startCrop}
                              className="flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors text-foreground/70 hover:text-foreground hover:bg-muted/80"
                            >
                              <Crop className="w-3.5 h-3.5 flex-shrink-0" />
                              크롭
                            </button>
                          )}
                        </>
                      ) : (
                        /* 선택된 이미지 없음 — Empty state */
                        <div className="flex flex-col items-center gap-2 px-2 py-4 text-center">
                          <ImageIcon className="w-7 h-7 text-muted-foreground/35" />
                          <p className="text-xs text-muted-foreground/55 leading-snug">캔버스에서 이미지를<br/>선택하거나 추가하세요</p>
                          <button
                            onClick={() => { imageInputRef.current?.click() }}
                            className="mt-0.5 flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg text-xs hover:bg-primary/20 transition-colors"
                          >
                            <ImagePlus className="w-3.5 h-3.5" />
                            이미지 추가
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                  {openSubPanel === 'shapes' && (
                    <motion.div
                      key="shapes-float"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-full bottom-0 mr-2 flex flex-col gap-2 p-2.5 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl z-30"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {/* 도형 타입 */}
                      <div className="flex items-center gap-0.5">
                        {([
                          { type: 'circle' as const, icon: Circle, label: '원' },
                          { type: 'rect'   as const, icon: Square, label: '사각형' },
                          { type: 'star'   as const, icon: Star,   label: '별' },
                          { type: 'line'   as const, icon: Minus,  label: '직선' },
                        ] as const).map(({ type, icon: Icon, label }) => (
                          <button
                            key={type}
                            onClick={() => setShapeType(type)}
                            title={label}
                            className={cn(
                              'w-9 h-9 flex items-center justify-center rounded-md transition-colors',
                              shapeType === type
                                ? 'bg-primary/20 text-primary ring-1 ring-inset ring-primary/40'
                                : 'text-foreground/60 hover:text-foreground hover:bg-muted/80'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        ))}
                      </div>
                      <div className="h-px bg-border/60" />
                      {/* 굵기 */}
                      <div className="flex items-center gap-0.5">
                        {WIDTHS.map((w) => (
                          <button key={w} onClick={() => setShapeWidth(w)}
                            title={`굵기 ${w}`}
                            className={cn('w-8 h-8 flex items-center justify-center rounded-md transition-colors',
                              shapeWidth === w
                                ? 'bg-primary/12 hover:bg-primary/20'
                                : 'hover:bg-muted/80'
                            )}>
                            <div className="rounded-full" style={{ width: Math.min(w, 14), height: Math.min(w, 14), background: shapeColor }} />
                          </button>
                        ))}
                      </div>
                      <div className="h-px bg-border/60" />
                      {/* 색상 */}
                      <div className="flex items-center gap-2 px-0.5">
                        {(isDark ? PEN_COLORS_DARK : PEN_COLORS_LIGHT).map((c, i) => (
                          <button key={i} onClick={() => setShapeColorIdx(i)}
                            title={['기본', '빨강', '파랑'][i]}
                            className={cn('w-6 h-6 rounded-full transition-transform hover:scale-110 ring-offset-1',
                              shapeColorIdx === i ? 'ring-2 ring-primary scale-110' : 'ring-1 ring-black/10'
                            )}
                            style={{ background: c }} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Sep />

              {/* Undo / Redo — 항상 최하단 */}
              <ToolBtn icon={RotateCcw} onClick={handleUndo} disabled={undoCount === 0} title="실행 취소 (⌘Z)" />
              <ToolBtn icon={RotateCw}  onClick={handleRedo} disabled={redoCount === 0} title="다시 실행 (⌘Y)" />

        </motion.div>
      </div>
    </div>
  )
}
