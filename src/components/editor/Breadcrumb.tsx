import { Fragment } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTreeStore } from '@/stores/treeStore'
import { getAncestors } from '@/lib/tree-utils'

interface BreadcrumbProps {
  pageId: string
}

export function Breadcrumb({ pageId }: BreadcrumbProps) {
  const tree = useTreeStore((s) => s.tree)
  const ancestors = getAncestors(tree, pageId)

  if (!ancestors.length) return null

  return (
    <nav
      className="flex items-center gap-0.5 px-8 pb-2 text-xs text-muted-foreground/60"
      aria-label="breadcrumb"
    >
      {ancestors.map((a, i) => (
        <Fragment key={a.id}>
          {i > 0 && <ChevronRight className="w-3 h-3 opacity-50 flex-shrink-0" />}
          <span className="truncate max-w-[120px] hover:text-muted-foreground transition-colors">
            {a.title}
          </span>
        </Fragment>
      ))}
    </nav>
  )
}
