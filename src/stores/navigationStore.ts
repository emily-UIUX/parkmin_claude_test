import { create } from 'zustand'

interface NavigationState {
  activePageId: string | null
  activeNotebookId: string | null
  setActivePageId: (id: string | null) => void
  setActiveNotebookId: (id: string | null) => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activePageId: null,
  activeNotebookId: null,
  setActivePageId: (id) => set({ activePageId: id }),
  setActiveNotebookId: (id) => set({ activeNotebookId: id }),
}))
