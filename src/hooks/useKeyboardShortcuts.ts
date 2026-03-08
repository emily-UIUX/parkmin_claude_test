import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'

export function useKeyboardShortcuts() {
  const { toggleSidebar, setSearchOpen } = useUIStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      // Cmd/Ctrl + [ → Toggle sidebar
      if (mod && e.key === '[') {
        e.preventDefault()
        toggleSidebar()
      }

      // Cmd/Ctrl + E → Search
      if (mod && e.key === 'e') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSidebar, setSearchOpen])
}
