import { useTranslation } from 'react-i18next'
import { daysUntilPurge } from '@/lib/softDeleteRetention'

/**
 * Human-readable time left before the purge job removes a soft-deleted row.
 *
 * "No deadline" is a real state, not a fallback: the purge filters
 * ``deleted_at < cutoff``, so a row without that timestamp is never swept.
 */
export function useExpiryLabel() {
  const { t } = useTranslation('common')

  return (deletedAt: string | null | undefined) => {
    const days = daysUntilPurge(deletedAt)
    if (days === null) return t('softDelete.expiry.noDeadline', 'No deadline')
    if (days === 0) return t('softDelete.expiry.today', 'Removed today')
    return t('softDelete.expiry.inDays', '{{count}} days left', { count: days })
  }
}
