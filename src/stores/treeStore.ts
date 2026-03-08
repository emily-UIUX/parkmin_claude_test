import { create } from 'zustand'
import type { TreeNode } from '@/types'

interface TreeState {
  tree: TreeNode[]
  setTree: (tree: TreeNode[]) => void
}

export const useTreeStore = create<TreeState>((set) => ({
  tree: [],
  setTree: (tree) => set({ tree }),
}))
