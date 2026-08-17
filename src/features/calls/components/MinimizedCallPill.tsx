import { useTranslation } from 'react-i18next'

import { Icons } from '@/lib/icons'
import { formatCallDuration } from '../utils/duration'

interface MinimizedCallPillProps {
  phoneNumber: string
  clientName?: string | null
  /** Absent while the call is only ringing. */
  durationSeconds?: number | null
  onRestore: () => void
}

/**
 * The call reduced to a bar in the header, so the operator can work the rest of
 * the CRM without losing it.
 *
 * Rendered inline beside the other header controls rather than floating: as an
 * overlay it covered the user menu, and a call that hides the thing behind it
 * is not "out of the way".
 */
export function MinimizedCallPill({
  phoneNumber,
  clientName,
  durationSeconds,
  onRestore,
}: MinimizedCallPillProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onRestore}
        aria-label={t('pages.clients.modals.callDialog.restore', 'Return to the call')}
        className="bg-success-500 hover:bg-success-600 flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
      >
        <Icons.Phone size={18} className="text-white" aria-hidden />
      </button>

      <span className="text-foreground max-w-40 truncate text-sm font-medium">
        {clientName || phoneNumber}
      </span>

      {durationSeconds != null && (
        <span className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm">
          <Icons.StopWatch size={14} aria-hidden />
          <span className="tabular-nums">{formatCallDuration(durationSeconds)}</span>
          <span className="bg-success-500 h-2 w-2 rounded-full" aria-hidden />
        </span>
      )}
    </div>
  )
}
