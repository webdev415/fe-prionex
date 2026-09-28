import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { qrRestartAt } from '../lib/approval'
import type { LoginApprovalPhase } from '../lib/approvalSession'
import { formatCountdown } from '../lib/pairing'
import { QrCodeImage } from './QrCodeImage'

interface AppQrLoginCardProps {
  /** The phase of the QR request; the login page owns it (`useLoginApproval`). */
  phase: LoginApprovalPhase
  /** «Новий код» / «Спробувати ще раз»: open a new QR request. */
  onRestart: () => void
  /**
   * `Date.now()` before which no new QR request may start: the 5-second limit
   * of the login page, which outlives this card (a tab switch unmounts it).
   * A 429 phase pushes it further, to the end of its own `minutes`.
   */
  notBefore: number
}

/**
 * The «QR-код» tab of the login page (story 19.17): the code to scan in
 * Prionex Hub → «Безпека», the time the request has left, and every outcome.
 */
export function AppQrLoginCard({ phase, onRestart, notBefore }: AppQrLoginCardProps) {
  const { t } = useTranslation('auth')
  const [now, setNow] = useState(() => Date.now())
  /** The code could not be drawn: shown as `failed` until a new request. */
  const [undrawable, setUndrawable] = useState(false)

  // One tick a second: the countdowns, and the end of the «Новий код» wait.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const restartAt = qrRestartAt(notBefore, phase)
  const waiting = now < restartAt
  const restart = () => {
    const at = Date.now()
    if (at < restartAt) return
    setNow(at)
    setUndrawable(false)
    onRestart()
  }

  const secondsLeft = (expiresAt: number, startedAt: number) =>
    Math.max(0, Math.ceil((expiresAt - Math.max(now, startedAt)) / 1000))

  const drawFailed = phase.kind === 'qr' && undrawable
  /** The code on screen is past its own `qr_expires_in` and no new one came yet. */
  const codeExpired = phase.kind === 'qr' && !drawFailed && now >= phase.codeExpiresAt
  const showCode = phase.kind === 'qr' && !drawFailed && !codeExpired

  const outcome = (() => {
    if (drawFailed) return t('appLogin.qr.outcome.failed')
    switch (phase.kind) {
      case 'denied':
        return t('appLogin.approval.outcome.denied')
      case 'expired':
        return t('appLogin.qr.outcome.expired')
      case 'rateLimited':
        return t('appLogin.qr.outcome.rateLimited', { minutes: phase.minutes })
      case 'blocked':
        return t('appLogin.qr.outcome.blocked', { minutes: phase.minutes })
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
        {showCode && (
          <p className="text-muted-foreground mt-1.5 px-2 text-sm font-light sm:mt-2 sm:px-0 sm:text-base">
            {t('appLogin.qr.hint')}
          </p>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {showCode && (
          <div className="flex flex-col items-center gap-3 text-center">
            <QrCodeImage
              value={phase.payload}
              label={t('appLogin.qr.imageLabel')}
              className="border-border h-56 w-56 overflow-hidden rounded-md border sm:h-64 sm:w-64"
              onError={() => setUndrawable(true)}
            />
            {/* The clock of the request (`expiresAt`); each code is replaced long before its own end. */}
            <p className="text-muted-foreground text-xs tabular-nums sm:text-sm">
              {t('appLogin.approval.waiting.validFor', {
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

        {(phase.kind === 'idle' ||
          phase.kind === 'starting' ||
          phase.kind === 'completing' ||
          codeExpired) && (
          <div
            className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm"
            role="status"
          >
            <Icons.Reload size={18} className="shrink-0 animate-spin" />
            <span>
              {phase.kind === 'completing'
                ? t('appLogin.approval.waiting.completing')
                : codeExpired
                  ? t('appLogin.qr.codeExpired')
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
            disabled={waiting}
          >
            {phase.kind === 'failed' || drawFailed
              ? t('appLogin.qr.retry')
              : t('appLogin.qr.newCode')}
          </Button>
        )}
      </div>
    </div>
  )
}

export default AppQrLoginCard
