import { lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Loader2 } from 'lucide-react'

// Lazy-load the heavy AppShell (includes TipTap editor)
const AppShell = lazy(() =>
  import('@/components/layout/AppShell').then((m) => ({ default: m.AppShell }))
)

function AppContent() {
  useKeyboardShortcuts()
  return (
    <Suspense
      fallback={
        <div className="h-dvh flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      }
    >
      <AppShell />
    </Suspense>
  )
}

export default function App() {
  return (
    <TooltipProvider>
      <AuthGuard>
        <AppContent />
      </AuthGuard>
      <Toaster position="bottom-right" richColors closeButton />
    </TooltipProvider>
  )
}
