import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Icons } from '@/lib/icons'
import { formatCallDuration } from '../utils/duration'

interface MinimizedCallPillProps {
  phoneNumber: string
  clientName?: string | null
  /** When this operator took the call. Null while it is only ringing. */
  answeredAt?: number | null
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
  answeredAt,
  onRestore,
}: MinimizedCallPillProps) {
  const { t } = useTranslation('common')
  const durationSeconds = useCallDuration(answeredAt)

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onRestore}
        aria-label={t('pages.clients.modals.callDialog.restore', 'Return to the call')}
        className="bg-success-400 hover:bg-success-300 flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
      >
        <Icons.Call size={18} className="text-success-900" aria-hidden />
      </button>

      <span className="text-foreground max-w-40 truncate text-sm font-medium">
        {clientName || phoneNumber}
      </span>

      {durationSeconds !== null && (
        <span className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm">
          <Icons.StopWatch size={14} aria-hidden />
          <span className="tabular-nums">{formatCallDuration(durationSeconds)}</span>
          <span className="bg-success-500 h-2 w-2 rounded-full" aria-hidden />
        </span>
      )}
    </div>
  )
}

/**
 * Seconds since the call was answered, advanced by this component.
 *
 * The pill lives in the header, which re-renders only when something else in
 * the app happens to change — so a duration computed by its parent freezes at
 * whatever it read when the call was minimised, and the operator watches a
 * stopped clock for the length of the conversation.
 */
function useCallDuration(answeredAt: number | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (answeredAt == null) return
    const handle = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(handle)
  }, [answeredAt])

  if (answeredAt == null) return null
  // A clock that has run backwards is the machine's fault, not the call's.
  return Math.max(0, Math.floor((now - answeredAt) / 1000))
}
