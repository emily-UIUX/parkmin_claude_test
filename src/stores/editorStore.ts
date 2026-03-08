import { create } from 'zustand'

type SaveStatus = 'saved' | 'saving' | 'offline' | 'error'

interface EditorState {
  saveStatus: SaveStatus
  pageTitle: string
  setSaveStatus: (status: SaveStatus) => void
  setPageTitle: (title: string) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  saveStatus: 'saved',
  pageTitle: '',
  setSaveStatus: (status) => set({ saveStatus: status }),
  setPageTitle: (title) => set({ pageTitle: title }),
}))
