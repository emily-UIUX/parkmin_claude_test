import type { Notebook, Page, TreeNode } from '@/types'

export function buildTree(notebooks: Notebook[], pages: Page[]): TreeNode[] {
  const nbMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // 1) Notebooks → TreeNode
  notebooks.forEach((nb) => {
    nbMap.set(nb.id, {
      id: nb.id,
      type: 'notebook',
      title: nb.title,
      depth: nb.depth,
      icon: nb.icon,
      color: nb.color,
      isExpanded: nb.is_expanded,
      children: [],
      parentId: nb.parent_id,
      sortOrder: nb.sort_order,
      pageCount: 0,
      data: nb,
    })
  })

  // 2) Link parent-child
  nbMap.forEach((node) => {
    if (node.parentId && nbMap.has(node.parentId)) {
      nbMap.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // 3) Add pages to notebook children
  pages.forEach((page) => {
    const parent = nbMap.get(page.notebook_id)
    if (parent) {
      parent.children.push({
        id: page.id,
        type: 'page',
        title: page.title,
        depth: parent.depth + 1,
        icon: '📄',
        color: '',
        isExpanded: false,
        children: [],
        parentId: page.notebook_id,
        sortOrder: page.sort_order,
        data: page,
      })
      parent.pageCount = (parent.pageCount || 0) + 1
    }
  })

  // 4) Sort: pinned pages → notebooks → regular pages, by sort_order
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const aPinned =
        a.type === 'page' &&
        'is_pinned' in a.data &&
        (a.data as Page).is_pinned
      const bPinned =
        b.type === 'page' &&
        'is_pinned' in b.data &&
        (b.data as Page).is_pinned
      if (aPinned !== bPinned) return aPinned ? -1 : 1
      if (a.type !== b.type) return a.type === 'notebook' ? -1 : 1
      return a.sortOrder - b.sortOrder
    })
    nodes.forEach((n) => {
      if (n.children.length) sortChildren(n.children)
    })
  }

  sortChildren(roots)
  return roots
}

export function findNodeById(tree: TreeNode[], id: string): TreeNode | null {
  for (const node of tree) {
    if (node.id === id) return node
    const found = findNodeById(node.children, id)
    if (found) return found
  }
  return null
}

export function flattenTree(tree: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []
  const traverse = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      result.push(node)
      traverse(node.children)
    }
  }
  traverse(tree)
  return result
}

export function getAncestors(tree: TreeNode[], nodeId: string): TreeNode[] {
  const ancestors: TreeNode[] = []
  const findPath = (nodes: TreeNode[], target: string): boolean => {
    for (const node of nodes) {
      if (node.id === target) return true
      if (findPath(node.children, target)) {
        ancestors.unshift(node)
        return true
      }
    }
    return false
  }
  findPath(tree, nodeId)
  return ancestors
}
