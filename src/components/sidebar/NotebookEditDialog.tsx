import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NOTEBOOK_COLORS } from '@/types'
import type { TreeNode } from '@/types'
import type { Notebook } from '@/types'
import { cn } from '@/lib/utils'

// Lucide-animated icon components
import { FolderOpenIcon }    from '@/components/ui/folder-open'
import { BookTextIcon }      from '@/components/ui/book-text'
import { MailCheckIcon }     from '@/components/ui/mail-check'
import { BellIcon }          from '@/components/ui/bell'
import { CalendarCheckIcon } from '@/components/ui/calendar-check'
import { FileTextIcon }      from '@/components/ui/file-text'
import type { HTMLAttributes, ComponentType } from 'react'

type AnimatedIconComponent = ComponentType<HTMLAttributes<HTMLDivElement> & { size?: number }>

const ANIMATED_ICONS: { name: string; Icon: AnimatedIconComponent }[] = [
  { name: 'folder-open',    Icon: FolderOpenIcon    },
  { name: 'book-text',      Icon: BookTextIcon      },
  { name: 'mail-check',     Icon: MailCheckIcon     },
  { name: 'bell',           Icon: BellIcon          },
  { name: 'calendar-check', Icon: CalendarCheckIcon },
  { name: 'file-text',      Icon: FileTextIcon      },
]

interface NotebookEditDialogProps {
  open: boolean
  node: TreeNode | null
  onClose: () => void
  onSave: (nodeId: string, changes: { title: string; color: string; icon: string }) => void
}

export function NotebookEditDialog({ open, node, onClose, onSave }: NotebookEditDialogProps) {
  const notebook = node?.data as Notebook | undefined

  const [title, setTitle] = useState('')
  const [color, setColor] = useState('')
  const [icon, setIcon] = useState('')

  useEffect(() => {
    if (node && notebook) {
      setTitle(node.title)
      setColor(notebook.color ?? '')
      setIcon(notebook.icon ?? '')
    }
  }, [node])

  const handleSave = () => {
    if (!node) return
    onSave(node.id, { title: title.trim() || node.title, color, icon })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="w-80 p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold">노트북 편집</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              이름
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              색상
            </label>
            <div className="grid grid-cols-8 gap-1.5">
              {NOTEBOOK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none',
                    color === c && 'ring-2 ring-offset-2 ring-offset-background'
                  )}
                  style={{
                    backgroundColor: c,
                    ringColor: c,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <div className="flex items-center">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                아이콘
              </label>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {ANIMATED_ICONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  onClick={() => setIcon(icon === name ? '' : name)}
                  title={name}
                  className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-md transition-colors',
                    icon === name
                      ? 'bg-primary/15 ring-1 ring-primary/40 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                  )}
                >
                  <Icon size={20} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="px-4 py-3 border-t border-border gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button size="sm" onClick={handleSave}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
