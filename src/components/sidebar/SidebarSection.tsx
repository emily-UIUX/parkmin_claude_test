import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ReactNode, ComponentType } from 'react'

interface SidebarSectionProps {
  title: string
  icon: ComponentType<{ className?: string }>
  iconColor?: string
  count?: number
  actions?: ReactNode
  defaultOpen?: boolean
  storageKey: string
  children: ReactNode
}

export function SidebarSection({
  title,
  icon: Icon,
  iconColor,
  count,
  actions,
  defaultOpen = true,
  storageKey,
  children,
}: SidebarSectionProps) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(`sidebar-section-${storageKey}`)
      return stored !== null ? stored === 'true' : defaultOpen
    } catch {
      return defaultOpen
    }
  })

  const toggle = () => {
    const next = !isOpen
    setIsOpen(next)
    try {
      localStorage.setItem(`sidebar-section-${storageKey}`, String(next))
    } catch { /* ignore */ }
  }

  return (
    <div className="py-0.5">
      {/* Section header */}
      <button
        onClick={toggle}
        className="group flex items-center w-full h-7 px-2 gap-1.5 rounded-md hover:bg-muted/60 transition-colors"
      >
        <motion.span
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-center"
        >
          <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
        </motion.span>
        <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', iconColor ?? 'text-muted-foreground')} />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1 text-left">
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span className="text-[10px] text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded-full leading-none">
            {count}
          </span>
        )}
        {actions && (
          <span
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {actions}
          </span>
        )}
      </button>

      {/* Animated content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
