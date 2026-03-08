import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error) => ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) return this.props.fallback(error)
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-sm">
          <div className="text-destructive font-semibold text-base">렌더링 오류</div>
          <pre className="bg-muted rounded p-4 text-xs max-w-xl w-full overflow-auto whitespace-pre-wrap break-all">
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90"
          >
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
