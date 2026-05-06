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
      {/* Shell: gray ring + green top segment (same pattern as SearchResults spinner).
          Avoid mixing border-t-transparent with competing border-* utilities — merge order
          can drop the accent stroke on light backgrounds so the spinner looks like a dead gray dot. */}
      <div
        className={cn(
          'shrink-0 rounded-full border-[3px] motion-safe:animate-spin',
          variant === 'auth'
            ? 'h-12 w-12 border-white/25 border-t-white'
            : 'border-t-primary-600 h-12 w-12 border-gray-300'
        )}
        aria-hidden
      />
    </div>
  )
}
