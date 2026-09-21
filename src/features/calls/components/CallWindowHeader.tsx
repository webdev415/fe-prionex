import { useTranslation } from 'react-i18next'

import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatCallDuration } from '../utils/duration'
import { piiProps } from '@/lib/openreplay/pii'

interface CallWindowHeaderProps {
  phoneNumber: string
  /** Absent when several clients matched, so no single one owns the number. */
  clientName?: string | null
  /** True only when the number matched nobody at all. */
  unknown?: boolean
  /** Shown only once connected; the ringing state has no duration to report. */
  durationSeconds?: number | null
  /** The line is down: the dot stops meaning "in progress". */
  ended?: boolean
  onMinimize: () => void
}

/**
 * Who is on the line, and for how long.
 *
 * Deliberately no close control: the window must not be dismissable while the
 * line is up, so the only ways out are minimising or hanging up.
 */
export function CallWindowHeader({
  phoneNumber,
  clientName,
  unknown = false,
  durationSeconds,
  ended = false,
  onMinimize,
}: CallWindowHeaderProps) {
  const { t } = useTranslation('common')
  const connected = durationSeconds != null

  return (
    <div className="flex shrink-0 items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* Green from the moment the line is up, not from acceptance — the
              dot reports the line, and the timer reports the conversation. */}
          {/* Green means a live line. Once the call is over the window is only
              still here so the interaction can be filed, and a green dot over a
              dead line reads as a call the operator has failed to hang up. */}
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              ended ? 'bg-muted-foreground' : 'bg-success-500'
            )}
            aria-hidden
          />
          <span className="text-foreground truncate text-sm font-medium sm:text-base">
            {phoneNumber}
          </span>
        </div>
        {/* Only an unmatched number is "unknown". Several matches means no
            single client owns it — naming one, or calling the caller unknown,
            both assert something the payload does not support. */}
        {(clientName || unknown) && (
          <div className="text-foreground truncate text-lg font-semibold sm:text-xl" {...piiProps}>
            {clientName || t('pages.clients.modals.callDialog.unknownContact', 'Unknown contact')}
          </div>
        )}
      </div>

      {connected && (
        <div
          className="bg-muted text-muted-foreground flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm"
          aria-label={t('pages.clients.modals.callDialog.callDuration', 'Call Duration')}
        >
          <Icons.StopWatch size={14} aria-hidden />
          <span className="tabular-nums">{formatCallDuration(durationSeconds)}</span>
        </div>
      )}

      <button
        type="button"
        onClick={onMinimize}
        className="hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
        aria-label={t('pages.clients.modals.callDialog.minimize', 'Minimize')}
      >
        <Icons.Remove02 size={20} className="text-foreground" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  )
}
