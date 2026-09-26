import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { formatCountdown, formatPairingCode, safePairingUrl } from '../lib/pairing'
import type { AppLoginPairing } from '../types'

interface AppLoginPairingPanelProps {
  pairing: AppLoginPairing
  /** `Date.now()` when the code arrived; the countdown runs from here. */
  issuedAt: number
  onRequestNew: () => void
  onCancel: () => void
}

/**
 * The code and QR the phone needs, with a live countdown. The parent polls the
 * status and swaps this panel for «<phone> підключено» once the device lands.
 */
export function AppLoginPairingPanel({
  pairing,
  issuedAt,
  onRequestNew,
  onCancel,
}: AppLoginPairingPanelProps) {
  const { t } = useTranslation('auth')
  const expiresAt = issuedAt + pairing.expires_in * 1000
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  const expired = secondsLeft === 0
  const code = formatPairingCode(pairing.pairing_code)
  // Only the API's own deep link, and only with the phone's scheme (it lands in
  // an href). No link at all beats a guessed one — the code is enough.
  const url = safePairingUrl(pairing.pairing_url)

  if (expired) {
    return (
      <div
        className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4"
        role="status"
      >
        <span className="text-foreground text-sm font-semibold">
          {t('appLogin.pairing.expiredTitle')}
        </span>
        <span className="text-muted-foreground text-xs sm:text-sm">
          {t('appLogin.pairing.expiredHint')}
        </span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="primary"
            onClick={onRequestNew}
            className="h-11 flex-1 rounded-md"
          >
            {t('appLogin.pairing.requestNew')}
          </Button>
          <Button
            type="button"
            variant="cancel"
            onClick={onCancel}
            className="h-11 flex-1 rounded-md"
          >
            {t('appLogin.pairing.close')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4">
      <p className="text-foreground text-xs sm:text-sm">{t('appLogin.pairing.instructions')}</p>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {pairing.pairing_qr_png_base64 ? (
          <figure className="flex shrink-0 flex-col items-center gap-1">
            <img
              src={`data:image/png;base64,${pairing.pairing_qr_png_base64}`}
              alt={t('appLogin.pairing.qrAlt')}
              className="h-40 w-40 rounded-md bg-white p-2"
            />
            <figcaption className="text-muted-foreground text-center text-xs">
              {t('appLogin.pairing.qrHint')}
            </figcaption>
          </figure>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-muted-foreground text-xs">{t('appLogin.pairing.codeLabel')}</span>
          <span
            data-testid="app-login-pairing-code"
            className="text-foreground font-mono text-2xl font-semibold tracking-[0.2em] select-all"
          >
            {code}
          </span>
          <span className="text-muted-foreground text-xs sm:text-sm" aria-live="polite">
            {t('appLogin.pairing.validFor', { time: formatCountdown(secondsLeft) })}
          </span>
          {url && (
            <a
              href={url}
              className="text-primary-700 truncate text-xs underline-offset-2 hover:underline"
            >
              {t('appLogin.pairing.openOnPhone')}
            </a>
          )}
        </div>
      </div>

      <div
        className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm"
        role="status"
      >
        <Icons.Reload size={16} className="shrink-0 animate-spin" />
        <span>{t('appLogin.pairing.waiting')}</span>
      </div>

      <Button type="button" variant="cancel" onClick={onCancel} className="h-11 w-full rounded-md">
        {t('appLogin.pairing.close')}
      </Button>
    </div>
  )
}

export default AppLoginPairingPanel
