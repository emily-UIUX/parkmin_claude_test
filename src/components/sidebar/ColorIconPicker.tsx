import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { NOTEBOOK_COLORS, NOTEBOOK_ICONS } from '@/types'

// ─── NotebookSettingsPicker — combined color + icon (triggered by icon click) ─

interface NotebookSettingsPickerProps {
  currentColor: string
  onColorSelect: (color: string) => void
  onIconSelect: (icon: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function NotebookSettingsPicker({
  currentColor,
  onColorSelect,
  onIconSelect,
  open,
  onOpenChange,
  children,
}: NotebookSettingsPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-52 p-3" side="right" align="start" sideOffset={4}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">색상</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {NOTEBOOK_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onColorSelect(c)}
              className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
              style={{
                backgroundColor: c,
                outline: currentColor === c ? `3px solid ${c}` : undefined,
                outlineOffset: currentColor === c ? '2px' : undefined,
              }}
            />
          ))}
        </div>
        <div className="border-t border-border mb-3" />
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">아이콘</p>
        <div className="grid grid-cols-6 gap-1">
          {NOTEBOOK_ICONS.map((icon) => (
            <button
              key={icon}
              onClick={() => { onIconSelect(icon); onOpenChange(false) }}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-accent text-base transition-colors"
            >
              {icon}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface ColorPickerProps {
  currentColor: string
  onSelect: (color: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function ColorPicker({ currentColor, onSelect, open, onOpenChange, children }: ColorPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 p-3" side="right" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2">색상 선택</p>
        <div className="grid grid-cols-4 gap-2">
          {NOTEBOOK_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => { onSelect(color); onOpenChange(false) }}
              className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
              style={{
                backgroundColor: color,
                outline: currentColor === color ? `3px solid ${color}` : undefined,
                outlineOffset: currentColor === color ? '2px' : undefined,
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface IconPickerProps {
  onSelect: (icon: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function IconPicker({ onSelect, open, onOpenChange, children }: IconPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-3" side="right" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2">아이콘 선택</p>
        <div className="grid grid-cols-6 gap-1">
          {NOTEBOOK_ICONS.map((icon) => (
            <button
              key={icon}
              onClick={() => { onSelect(icon); onOpenChange(false) }}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-accent text-base transition-colors"
            >
              {icon}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
