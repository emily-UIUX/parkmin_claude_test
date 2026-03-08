import { create } from 'zustand'

interface UIState {
  isSidebarOpen: boolean
  isDarkMode: boolean
  isSearchOpen: boolean
  sidebarWidth: number
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleDarkMode: () => void
  setSearchOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  isDarkMode: false,
  isSearchOpen: false,
  sidebarWidth: 300,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleDarkMode: () =>
    set((s) => {
      const next = !s.isDarkMode
      document.documentElement.classList.toggle('dark', next)
      return { isDarkMode: next }
    }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
}))
