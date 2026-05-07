/**
 * Full-screen loading UI for Suspense fallbacks and auth bootstrap.
 * Border colours use inline styles so Prettier/tailwind-merge cannot reorder
 * classes in a way that drops the accent stroke (which looked like a dead gray dot).
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const SPINNER_BOX =
  'box-border h-12 w-12 shrink-0 animate-spin rounded-full border-[3px] border-solid'

export function AppLoadingFallback() {
  const { t } = useTranslation('common')

  const spinnerStyle = {
    borderColor: 'var(--color-gray-300)',
    borderTopColor: 'var(--color-primary-600)',
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-dvh w-full flex-col items-center justify-center bg-gradient-to-br from-[#F5F6F3] to-[#EBECE8]'
      )}
    >
      <span className="sr-only">{t('status.loading')}</span>
      <div className={SPINNER_BOX} style={spinnerStyle} aria-hidden />
    </div>
  )
}
