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
 * The call reduced to a bar, so the operator can work the rest of the CRM
 * without losing it.
 *
 * Rendered by the call window itself rather than through the call store: a
 * round trip would rebuild the window on restore and take the half-written
 * interaction with it, which is not recoverable while the caller is on the
 * line.
 */
export function MinimizedCallPill({
  phoneNumber,
  clientName,
  durationSeconds,
  onRestore,
}: MinimizedCallPillProps) {
  const { t } = useTranslation('common')

  return (
    <div className="border-border bg-card fixed top-3 right-4 z-50 flex items-center gap-3 rounded-full border py-1.5 pr-1.5 pl-3 shadow-lg">
      <span className="bg-success-500 h-2 w-2 shrink-0 rounded-full" aria-hidden />
      <span className="text-foreground max-w-48 truncate text-sm font-medium">
        {clientName || phoneNumber}
      </span>
      {durationSeconds != null && (
        <span className="text-muted-foreground text-sm tabular-nums">
          {formatCallDuration(durationSeconds)}
        </span>
      )}
      <button
        type="button"
        onClick={onRestore}
        aria-label={t('pages.clients.modals.callDialog.restore', 'Return to the call')}
        className="bg-success-500 hover:bg-success-600 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
      >
        <Icons.Phone size={16} className="text-white" aria-hidden />
      </button>
    </div>
  )
}
