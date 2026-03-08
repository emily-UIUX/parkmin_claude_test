import { useRef, useCallback } from 'react'
import { useUIStore } from '@/stores/uiStore'

// Swipe handler for sidebar open/close on touch devices
export function useSidebarSwipe() {
  const { setSidebarOpen } = useUIStore()
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return
    const dx = e.changedTouches[0].clientX - startX.current
    const dy = e.changedTouches[0].clientY - startY.current

    // Only act on mostly horizontal swipes
    if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 50) {
      if (dx > 0 && startX.current < 30) {
        // Swipe right from left edge → open sidebar
        setSidebarOpen(true)
      } else if (dx < -50) {
        // Swipe left → close sidebar
        setSidebarOpen(false)
      }
    }
    startX.current = null
    startY.current = null
  }, [setSidebarOpen])

  return { onTouchStart, onTouchEnd }
}

// Long-press hook for touch devices
export function useLongPress(callback: () => void, ms = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const movedRef = useRef(false)

  const onTouchStart = useCallback(() => {
    movedRef.current = false
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) callback()
    }, ms)
  }, [callback, ms])

  const onTouchMove = useCallback(() => {
    movedRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const onTouchEnd = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { onTouchStart, onTouchMove, onTouchEnd }
}

// Detect Apple Pencil
export function isPencilInput(e: React.PointerEvent): boolean {
  return e.pointerType === 'pen'
}

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}
