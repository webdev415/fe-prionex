import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import type { LoginApprovalPhase } from '../lib/approvalSession'
import { AppApprovalWaiting } from './AppApprovalWaiting'

export type AppApprovalMode = 'passwordless' | 'second_factor'

interface AppApprovalCardProps {
  phase: LoginApprovalPhase
  /** Passwordless falls back to the password form, the 2FA step to the TOTP code. */
  mode: AppApprovalMode
  /** The 2FA step names who is signing in, like `TwoFactorCodeCard`. */
  username?: string | null
  onCancel: () => void
  onResend: () => void
  /** «Увійти з паролем» (passwordless) / «Ввести код з Google Authenticator» (2FA). */
  onFallback: () => void
}

/**
 * «Підтвердіть вхід на телефоні»: the number, the time left and every outcome
 * of one request. The card only draws `phase`; the login page owns the request
 * (`useLoginApproval`) and maps the `/login` refusals to its own cards.
 */
export function AppApprovalCard({
  phase,
  mode,
  username,
  onCancel,
  onResend,
  onFallback,
}: AppApprovalCardProps) {
  const { t } = useTranslation('auth')
  const secondFactor = mode === 'second_factor'
  const fallbackLabel = secondFactor
    ? t('appLogin.approval.useTotp')
    : t('appLogin.approval.usePassword')
  const inFlight =
    phase.kind === 'idle' ||
    phase.kind === 'starting' ||
    phase.kind === 'waiting' ||
    phase.kind === 'completing'

  const outcome = (() => {
    switch (phase.kind) {
      case 'denied':
        return t('appLogin.approval.outcome.denied')
      case 'expired':
        return t('appLogin.approval.outcome.expired')
      case 'rateLimited':
        return secondFactor
          ? t('appLogin.approval.outcome.rateLimitedSecondFactor', { minutes: phase.minutes })
          : t('appLogin.approval.outcome.rateLimited', { minutes: phase.minutes })
      case 'blocked':
        return t('appLogin.approval.outcome.blocked', { minutes: phase.minutes })
      case 'failed':
        return secondFactor
          ? t('appLogin.approval.outcome.failedSecondFactor')
          : t('appLogin.approval.outcome.failed')
      default:
        return null
    }
  })()

  return (
    <div className="w-full">
      <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6 md:mb-8">
        <div className="bg-primary-300 mb-3 flex h-12 w-12 items-center justify-center rounded-full sm:mb-4">
          <Icons.Phone size={24} className="text-primary-foreground" strokeWidth={2} />
        </div>
        <h1 className="text-foreground text-2xl font-medium md:text-[30px]">
          {inFlight ? t('appLogin.approval.waiting.title') : t('appLogin.approval.request.title')}
        </h1>
        {secondFactor && username && (
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {t('twoFactor.signedInAs', { username })}
          </p>
        )}
      </div>

      <div className="space-y-3 sm:space-y-4">
        {phase.kind === 'waiting' && (
          <AppApprovalWaiting
            // A resend is a new request: restart the countdown with it.
            key={phase.startedAt}
            number={phase.number}
            startedAt={phase.startedAt}
            expiresAt={phase.expiresAt}
            onResend={secondFactor ? onResend : undefined}
          />
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
                : t('appLogin.approval.waiting.starting')}
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

        {phase.kind === 'expired' && (
          <Button
            type="button"
            size="xl"
            className="mt-2 w-full text-sm sm:text-base"
            onClick={onResend}
          >
            {t('appLogin.approval.resend')}
          </Button>
        )}

        {inFlight ? (
          phase.kind !== 'completing' && (
            <Button
              type="button"
              variant="light"
              size="xl"
              className="w-full text-sm sm:text-base"
              onClick={onCancel}
            >
              {t('appLogin.approval.waiting.cancel')}
            </Button>
          )
        ) : (
          <Button
            type="button"
            variant={phase.kind === 'expired' ? 'light' : 'primary'}
            size="xl"
            className="w-full text-sm sm:text-base"
            onClick={onFallback}
          >
            {fallbackLabel}
          </Button>
        )}

        {inFlight && phase.kind !== 'completing' && (
          <button
            type="button"
            onClick={onFallback}
            className="text-primary-600 hover:text-primary-700 mt-2 w-full text-center text-xs underline-offset-2 hover:underline sm:text-sm"
          >
            {fallbackLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export default AppApprovalCard
