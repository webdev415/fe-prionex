/**
 * Error State Component
 *
 * Consistent error display component for use across the application.
 * Provides a standardized way to show errors with optional retry functionality.
 */

import { useTranslation } from 'react-i18next'
import { Button } from './ui/Button'
import { Alert } from './ui/Alert'
import { getErrorMessage } from '@/lib/errors'
import { Icons } from '@/lib/icons'

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
}

export function ErrorState({ error, onRetry, title, className }: ErrorStateProps) {
  const { t } = useTranslation('common')
  const errorMessage = getErrorMessage(error)

  return (
    <div className={`rounded-lg bg-white p-8 text-center shadow-sm ${className || ''}`}>
      <div className="mb-4 flex justify-center">
        <Icons.Warning size={48} className="text-error-500" strokeWidth={1.5} />
      </div>
      {title && <h3 className="text-dark-500 mb-2 text-lg font-semibold">{title}</h3>}
      <p className="mb-6 text-sm text-gray-600">{errorMessage}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="primary" className="bg-primary-300 text-dark-500">
          {t('components.errorState.tryAgain', 'Try Again')}
        </Button>
      )}
    </div>
  )
}

/**
 * Inline Error Alert Component
 * For displaying errors within forms or smaller spaces
 */
interface InlineErrorProps {
  error: unknown
  className?: string
}

export function InlineError({ error, className }: InlineErrorProps) {
  const errorMessage = getErrorMessage(error)

  return (
    <Alert variant="error" className={className}>
      <p className="text-sm">{errorMessage}</p>
    </Alert>
  )
}
