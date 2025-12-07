/**
 * Error Boundary Component
 *
 * Catches React rendering errors and displays a fallback UI.
 * Prevents the entire app from crashing when a component throws an error.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/Button'
import { colors } from '@/lib/colors'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center p-8"
          style={{ backgroundColor: colors.light[50] }}
        >
          <div
            className="w-full max-w-md rounded-lg p-8 shadow-lg"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            <h1 className="mb-4 text-2xl font-semibold" style={{ color: colors.neutral.dark[500] }}>
              Something went wrong
            </h1>
            <p className="mb-6 text-sm" style={{ color: colors.gray[600] }}>
              {this.state.error?.message ||
                'An unexpected error occurred. Please try refreshing the page.'}
            </p>
            <div className="flex gap-3">
              <Button
                onClick={this.handleReset}
                variant="primary"
                className="flex-1"
                style={{
                  backgroundColor: colors.primary[300],
                  color: colors.neutral.dark[500],
                }}
              >
                Try Again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="flex-1"
                style={{
                  borderColor: colors.gray[400],
                  color: colors.neutral.dark[500],
                }}
              >
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
