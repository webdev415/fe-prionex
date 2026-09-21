import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { isDomTranslationConflictError } from '@/lib/domTranslationCompat'
import { Button } from './ui/Button'

const getErrorMessage = (error: unknown, t: TFunction): string => {
  if (isRouteErrorResponse(error))
    return (
      error.statusText || t('components.routeError.unexpectedRouteError', 'Unexpected route error.')
    )
  if (error instanceof Error) return error.message
  return t(
    'components.routeError.unexpectedPageError',
    'An unexpected error occurred while loading this page.'
  )
}

const isLikelyStaleChunkError = (error: unknown, t: TFunction): boolean => {
  const message = getErrorMessage(error, t).toLowerCase()
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('chunkloaderror') ||
    message.includes('loading chunk')
  )
}

export function RouteErrorElement() {
  const { t } = useTranslation('common')
  const error = useRouteError()
  const staleChunk = isLikelyStaleChunkError(error, t)
  const translationConflict = isDomTranslationConflictError(error)

  return (
    <div className="bg-light-50 flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h1 className="text-dark-500 mb-3 text-2xl font-semibold">
          {staleChunk
            ? t('components.routeError.newVersionTitle', 'New version available')
            : translationConflict
              ? t('components.routeError.translationConflictTitle', 'Browser translation conflict')
              : t('errors.somethingWentWrong', 'Something went wrong')}
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          {staleChunk
            ? t('components.routeError.newVersionMessage')
            : translationConflict
              ? t('components.routeError.translationConflictMessage')
              : getErrorMessage(error, t)}
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => window.location.reload()}
            variant="primary"
            className="bg-primary-300 text-dark-500 flex-1"
          >
            {t('components.routeError.refreshPage', 'Refresh Page')}
          </Button>
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="text-dark-500 flex-1 border-gray-400"
          >
            {t('components.routeError.goBack', 'Go Back')}
          </Button>
        </div>
      </div>
    </div>
  )
}
