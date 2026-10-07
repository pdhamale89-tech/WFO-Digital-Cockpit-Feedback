import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from './States'

interface Props { children: ReactNode }

/** Catches render/chunk-load errors so a failure shows a message and a reload button instead of a blank page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error('[feedback-portal] render error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="card">
        <ErrorState message="This page could not be displayed. A new version may have been released — reload to get the latest." onRetry={() => window.location.reload()} />
      </div>
    )
  }
}
