/**
 * Full-screen loading UI for Suspense fallbacks and auth bootstrap.
 * Keeps a simple centered spinner instead of top-left text.
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export type AppLoadingFallbackVariant = 'shell' | 'auth'

export interface AppLoadingFallbackProps {
  variant?: AppLoadingFallbackVariant
}

export function AppLoadingFallback({ variant = 'shell' }: AppLoadingFallbackProps) {
  const { t } = useTranslation('common')

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-dvh w-full flex-col items-center justify-center',
        variant === 'auth' ? 'bg-black' : 'bg-gradient-to-br from-[#F5F6F3] to-[#EBECE8]'
      )}
    >
      <span className="sr-only">{t('status.loading')}</span>
      <div
        className={cn(
          'h-10 w-10 animate-spin rounded-full border-2 border-t-transparent',
          variant === 'auth'
            ? 'border-white/20 border-t-white'
            : 'border-t-secondary-800 border-gray-200'
        )}
        aria-hidden
      />
    </div>
  )
}
