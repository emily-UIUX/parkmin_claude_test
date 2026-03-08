import { Button } from '@/components/ui/button'
import { FolderPlus } from 'lucide-react'

interface EmptyTreeStateProps {
  onCreate: () => void
}

export function EmptyTreeState({ onCreate }: EmptyTreeStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="text-5xl mb-3">📁</div>
      <h3 className="text-sm font-medium text-foreground mb-1">노트북이 없습니다</h3>
      <p className="text-xs text-muted-foreground mb-4">
        첫 번째 노트북을 만들어<br />메모를 시작하세요
      </p>
      <Button size="sm" onClick={onCreate} className="gap-2">
        <FolderPlus className="w-4 h-4" />
        새 노트북 만들기
      </Button>
    </div>
  )
}
