import { motion } from 'framer-motion'
import { Check, Loader2, WifiOff, AlertCircle } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { cn } from '@/lib/utils'

export function SaveIndicator() {
  const { saveStatus } = useEditorStore()

  const config = {
    saving:  { icon: Loader2,     label: '저장 중', spin: true,  cls: 'bg-muted/70 text-muted-foreground/60' },
    saved:   { icon: Check,       label: '저장됨',  spin: false, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    offline: { icon: WifiOff,     label: '오프라인',spin: false, cls: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
    error:   { icon: AlertCircle, label: '오류',    spin: false, cls: 'bg-destructive/10 text-destructive' },
  }[saveStatus]

  return (
    /* 칩 자체는 유지 — 배경색은 transition-colors, 너비는 layout으로 처리
       아이콘·텍스트는 즉시 교체 (AnimatePresence 제거 → 깜빡임 없음) */
    <motion.div
      layout
      transition={{ layout: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } }}
      className={cn(
        'flex items-center gap-1 text-xs font-medium flex-shrink-0',
        'px-2 py-1 rounded-md',
        'transition-colors duration-200',
        config.cls
      )}
    >
      <config.icon className={cn('w-3 h-3', config.spin && 'animate-spin')} />
      <span>{config.label}</span>
    </motion.div>
  )
}
