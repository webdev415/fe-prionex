import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { formatCountdown } from '../lib/pairing'
import { SECOND_FACTOR_RESEND_AFTER_S } from '../lib/approval'

interface AppApprovalWaitingProps {
  number: number
  startedAt: number
  expiresAt: number
  /** The 2FA step offers «Надіслати ще раз» after 30 s; the passwordless one does not. */
  onResend?: () => void
}

/**
 * The number to type into Prionex Hub and the time left. The countdown has its
 * own one-second tick: the poll answers every couple of seconds, and a timer
 * driven by them would jump.
 */
export function AppApprovalWaiting({
  number,
  startedAt,
  expiresAt,
  onResend,
}: AppApprovalWaitingProps) {
  const { t } = useTranslation('auth')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // `now` is from the last tick; a request accepted after it must not read as
  // longer-lived than it is.
  const reference = Math.max(now, startedAt)
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - reference) / 1000))
  const canResend = reference - startedAt >= SECOND_FACTOR_RESEND_AFTER_S * 1000

  return (
    <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
      {/* The instruction and the number are announced together; the countdown
          stays outside the live region or it would be read out every second. */}
      <div role="status" className="flex flex-col items-center gap-3 sm:gap-4">
        <p className="text-foreground text-sm sm:text-base">
          {t('appLogin.approval.waiting.instruction')}
        </p>
        <p
          data-testid="app-approval-number"
          className="text-foreground font-mono text-5xl leading-none font-semibold tracking-wider tabular-nums select-all md:text-6xl"
        >
          {number}
        </p>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums sm:text-sm">
        {t('appLogin.approval.waiting.validFor', { time: formatCountdown(secondsLeft) })}
      </p>
      <p className="text-muted-foreground text-xs sm:text-sm">
        {t('appLogin.approval.waiting.noPush')}
      </p>
      {onResend && (
        <Button
          type="button"
          variant="outline"
          size="md"
          className="w-full"
          onClick={onResend}
          disabled={!canResend}
        >
          {t('appLogin.approval.resend')}
        </Button>
      )}
    </div>
  )
}

export default AppApprovalWaiting
