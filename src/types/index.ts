export interface Notebook {
  id: string
  user_id: string
  parent_id: string | null
  title: string
  color: string
  icon: string
  depth: number // 0~3
  sort_order: number
  is_expanded: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  // client-side computed
  children: Notebook[]
  pages: Page[]
  page_count: number
}

export interface Page {
  id: string
  user_id: string
  notebook_id: string
  title: string
  content: Record<string, unknown> // TipTap JSON
  plain_text_content: string
  sort_order: number
  is_pinned: boolean
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  icon: string
}

export interface Attachment {
  id: string
  page_id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  thumbnail_path: string | null
  created_at: string
}

export interface Profile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

// ── Tree node unified type (for rendering) ──
export type TreeNodeType = 'notebook' | 'page'

export interface TreeNode {
  id: string
  type: TreeNodeType
  title: string
  depth: number
  icon: string
  color: string
  isExpanded: boolean
  children: TreeNode[]
  parentId: string | null
  sortOrder: number
  pageCount?: number
  data: Notebook | Page
}

// ── Context menu actions ──
export type NodeAction =
  | 'create-notebook'
  | 'create-page'
  | 'edit-notebook'
  | 'duplicate'
  | 'toggle-favorite'
  | 'archive'

// ── Notebook color presets ──
export const NOTEBOOK_COLORS = [
  '#7B68EE', // purple
  '#4A90D9', // blue
  '#00B4D8', // teal
  '#2ECC71', // green
  '#F1C40F', // yellow
  '#E67E22', // orange
  '#E74C3C', // red
  '#E91E63', // pink
] as const

// ── Notebook icon presets (Lucide icon names) ──
export const NOTEBOOK_ICONS = [
  'BookOpen', 'Book', 'FileText', 'Folder', 'Archive', 'Bookmark', 'Tag', 'Hash',
  'Briefcase', 'Lightbulb', 'Target', 'Star', 'Heart', 'Zap', 'Flame', 'Rocket',
  'Code2', 'Terminal', 'Globe', 'Database', 'Coffee', 'Music', 'Palette', 'Camera',
  'Home', 'Map', 'Calendar', 'Bell', 'Shield', 'Award', 'Gift', 'Search',
] as const

export type TrashItem = {
  id: string
  user_id: string
  item_type: 'notebook' | 'page'
  item_id: string
  original_parent_id: string | null
  title: string | null
  deleted_at: string
  auto_delete_at: string
  // enriched client-side for notebook items
  icon?: string | null
  color?: string | null
}

export type FavoriteItem = {
  id: string
  user_id: string
  notebook_id: string | null
  page_id: string | null
  sort_order: number
  created_at: string
}
