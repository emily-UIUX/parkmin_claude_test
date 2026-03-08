import {
  Folder,   FolderOpen,
  Book,     BookOpen,
  Mail,     MailOpen,
  Bell,     BellRing,
  Calendar, CalendarFold,
  File,     FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NotebookIconPair {
  collapsed: LucideIcon
  expanded:  LucideIcon
}

// Each entry defines the icon shown in collapsed vs expanded state
export const NOTEBOOK_ICON_MAP: Record<string, NotebookIconPair> = {
  'folder-open':    { collapsed: Folder,   expanded: FolderOpen  },
  'book-text':      { collapsed: Book,     expanded: BookOpen    },
  'mail-check':     { collapsed: Mail,     expanded: MailOpen    },
  'bell':           { collapsed: Bell,     expanded: BellRing    },
  'calendar-check': { collapsed: Calendar, expanded: CalendarFold },
  'file-text':      { collapsed: File,     expanded: FileText    },
}

export const NOTEBOOK_ICON_NAMES = Object.keys(NOTEBOOK_ICON_MAP)
