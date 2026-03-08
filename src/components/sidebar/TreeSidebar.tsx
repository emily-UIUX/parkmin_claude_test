import { useState } from 'react'
import { Star, Clock, Archive, PanelLeftClose, LogOut, Moon, Sun, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { TreeView } from './TreeView'
import { SidebarPanel } from './SidebarPanel'
import type { PanelType } from './SidebarPanel'
import { useUIStore } from '@/stores/uiStore'
import { supabase } from '@/lib/supabase'

export function TreeSidebar() {
  const { isDarkMode, toggleDarkMode, toggleSidebar, setSearchOpen } = useUIStore()
  const [activePanel, setActivePanel] = useState<PanelType>(null)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const togglePanel = (panel: PanelType) => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }

  return (
    <aside className="flex flex-col h-full bg-sidebar border-r border-border overflow-hidden">
      {/* App header */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0">
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-primary-foreground text-xs font-bold leading-none">J</span>
        </div>
        <span
          className="text-lg text-foreground flex-1"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >Jun Canvas</span>
        <button
          className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          onClick={toggleSidebar}
          title="사이드바 닫기"
        >
          <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Search button — full-width item above tree */}
      <div className="px-2 pt-1 pb-0.5 flex-shrink-0">
        <FooterBtn icon={Search} label="검색" onClick={() => setSearchOpen(true)} />
      </div>

      {/* Tree section */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <TreeView />
      </div>

      {/* Expandable bottom panels */}
      <SidebarPanel panel={activePanel} onClose={() => setActivePanel(null)} />

      {/* Footer */}
      <div className="border-t border-border px-2 py-1.5 flex-shrink-0 space-y-0.5">
        <FooterBtn icon={Star} label="즐겨찾기" active={activePanel === 'favorites'} onClick={() => togglePanel('favorites')} />
        <FooterBtn icon={Clock} label="최근 항목" active={activePanel === 'recent'} onClick={() => togglePanel('recent')} />
        <FooterBtn icon={Archive} label="아카이브" active={activePanel === 'trash'} onClick={() => togglePanel('trash')} />
        <Separator className="my-1" />
        {/* Icon-only bottom row: dark mode toggle + logout */}
        <div className="flex items-center justify-between px-1 py-0.5">
          <IconBtn
            icon={isDarkMode ? Sun : Moon}
            active={isDarkMode}
            onClick={toggleDarkMode}
            title={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          />
          <IconBtn
            icon={LogOut}
            onClick={handleSignOut}
            title="로그아웃"
          />
        </div>
      </div>
    </aside>
  )
}

interface FooterBtnProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  className?: string
  active?: boolean
}

function FooterBtn({ icon: Icon, label, onClick, className, active }: FooterBtnProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center w-full px-2 py-2 text-[15px] rounded-md transition-colors gap-2',
        active
          ? 'text-foreground bg-accent'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
        className
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}

interface IconBtnProps {
  icon: React.ComponentType<{ className?: string }>
  active?: boolean
  onClick?: () => void
  title?: string
}

function IconBtn({ icon: Icon, active, onClick, title }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  )
}
