import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { isDomTranslationConflictError } from '@/lib/domTranslationCompat'
import { Button } from './ui/Button'

const getErrorMessage = (error: unknown): string => {
  if (isRouteErrorResponse(error)) return error.statusText || 'Unexpected route error.'
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred while loading this page.'
}

const isLikelyStaleChunkError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('chunkloaderror') ||
    message.includes('loading chunk')
  )
}

export function RouteErrorElement() {
  const error = useRouteError()
  const staleChunk = isLikelyStaleChunkError(error)
  const translationConflict = isDomTranslationConflictError(error)

  return (
    <div className="bg-light-50 flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-dark-500 mb-3 text-2xl font-semibold">
          {staleChunk
            ? 'New version available'
            : translationConflict
              ? 'Browser translation conflict'
              : 'Something went wrong'}
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          {staleChunk
            ? 'The application was updated. Refresh to load the latest version.'
            : translationConflict
              ? 'Chrome or another extension translated this page while it was open, which breaks the UI. Turn off automatic translation for this site (Chrome address bar → translation icon → disable), then refresh. Use the language switcher inside the app instead.'
              : getErrorMessage(error)}
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => window.location.reload()}
            variant="primary"
            className="bg-primary-300 text-dark-500 flex-1"
          >
            Refresh Page
          </Button>
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="text-dark-500 flex-1 border-gray-400"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}
