import { useTranslation } from 'react-i18next'

import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatCallDuration } from '../utils/duration'

interface CallWindowHeaderProps {
  phoneNumber: string
  /** Absent when the number matched nobody. */
  clientName?: string | null
  /** Shown only once connected; the ringing state has no duration to report. */
  durationSeconds?: number | null
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
  durationSeconds,
  onMinimize,
}: CallWindowHeaderProps) {
  const { t } = useTranslation('common')
  const connected = durationSeconds != null

  return (
    <div className="flex shrink-0 items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              connected ? 'bg-success-500' : 'bg-primary'
            )}
            aria-hidden
          />
          <span className="text-foreground truncate text-sm font-medium sm:text-base">
            {phoneNumber}
          </span>
        </div>
        <div className="text-foreground truncate text-lg font-semibold sm:text-xl">
          {clientName || t('pages.clients.modals.callDialog.unknownContact', 'Unknown contact')}
        </div>
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
