import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { QR_RESTART_COOLDOWN_MS } from '../lib/approval'
import type { LoginApprovalPhase } from '../lib/approvalSession'
import { formatCountdown } from '../lib/pairing'
import { QrCodeImage } from './QrCodeImage'

interface AppQrLoginCardProps {
  /** The phase of the QR request; the login page owns it (`useLoginApproval`). */
  phase: LoginApprovalPhase
  /** «Новий код» / «Спробувати ще раз»: open a new QR request. */
  onRestart: () => void
}

/**
 * The «QR-код» tab of the login page (story 19.17): the code to scan in
 * Prionex Hub → «Безпека», the time the request has left, and every outcome.
 *
 * The card mounts with the request its tab just opened, so the 5-second limit
 * on «Новий код» counts from the mount and then from each click.
 */
export function AppQrLoginCard({ phase, onRestart }: AppQrLoginCardProps) {
  const { t } = useTranslation('auth')
  const [now, setNow] = useState(() => Date.now())
  const [lastStart, setLastStart] = useState(() => Date.now())

  // One tick a second: the countdown, and the end of the «Новий код» cooldown.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const coolingDown = Math.max(now, lastStart) - lastStart < QR_RESTART_COOLDOWN_MS
  const restart = () => {
    const at = Date.now()
    if (at - lastStart < QR_RESTART_COOLDOWN_MS) return
    setLastStart(at)
    setNow(at)
    onRestart()
  }

  const secondsLeft = (expiresAt: number, startedAt: number) =>
    Math.max(0, Math.ceil((expiresAt - Math.max(now, startedAt)) / 1000))

  const outcome = (() => {
    switch (phase.kind) {
      case 'denied':
        return t('appLogin.approval.outcome.denied')
      case 'expired':
        return t('appLogin.qr.outcome.expired')
      case 'rateLimited':
      case 'blocked':
        return t('appLogin.qr.outcome.rateLimited', { minutes: phase.minutes })
      case 'failed':
        return t('appLogin.qr.outcome.failed')
      default:
        return null
    }
  })()

  return (
    <div className="w-full">
      <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6">
        <h1 className="text-foreground text-2xl font-medium md:text-[30px]">
          {phase.kind === 'scanned' ? t('appLogin.approval.waiting.title') : t('appLogin.qr.title')}
        </h1>
        {phase.kind === 'qr' && (
          <p className="text-muted-foreground mt-1.5 px-2 text-sm font-light sm:mt-2 sm:px-0 sm:text-base">
            {t('appLogin.qr.hint')}
          </p>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {phase.kind === 'qr' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <QrCodeImage
              value={phase.payload}
              label={t('appLogin.qr.imageLabel')}
              className="border-border h-56 w-56 overflow-hidden rounded-md border sm:h-64 sm:w-64"
            />
            <p className="text-muted-foreground text-xs tabular-nums sm:text-sm">
              {t('appLogin.qr.validFor', {
                time: formatCountdown(secondsLeft(phase.expiresAt, phase.startedAt)),
              })}
            </p>
            <p className="text-muted-foreground text-xs sm:text-sm">{t('appLogin.qr.refreshes')}</p>
          </div>
        )}

        {phase.kind === 'scanned' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="bg-primary-300 flex h-12 w-12 items-center justify-center rounded-full">
              <Icons.Phone size={24} className="text-primary-foreground" strokeWidth={2} />
            </div>
            <p role="status" className="text-foreground text-sm sm:text-base">
              {t('appLogin.qr.scanned')}
            </p>
            <p className="text-muted-foreground text-xs tabular-nums sm:text-sm">
              {t('appLogin.approval.waiting.validFor', {
                time: formatCountdown(secondsLeft(phase.expiresAt, phase.startedAt)),
              })}
            </p>
          </div>
        )}

        {(phase.kind === 'idle' || phase.kind === 'starting' || phase.kind === 'completing') && (
          <div
            className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm"
            role="status"
          >
            <Icons.Reload size={18} className="shrink-0 animate-spin" />
            <span>
              {phase.kind === 'completing'
                ? t('appLogin.approval.waiting.completing')
                : t('appLogin.qr.starting')}
            </span>
          </div>
        )}

        {outcome && (
          <div
            role="alert"
            className="bg-error-50 border-error-500 text-body-xs sm:text-body-sm text-error-600 rounded-md border p-2.5 text-center sm:rounded-lg sm:p-3"
          >
            {outcome}
          </div>
        )}

        {outcome && (
          <Button
            type="button"
            size="xl"
            className="mt-2 w-full text-sm sm:text-base"
            onClick={restart}
            disabled={coolingDown}
          >
            {phase.kind === 'failed' ? t('appLogin.qr.retry') : t('appLogin.qr.newCode')}
          </Button>
        )}
      </div>
    </div>
  )
}

export default AppQrLoginCard
