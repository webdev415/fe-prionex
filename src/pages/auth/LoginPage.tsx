import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthLayout } from '@/components/layout'
import type { LoginFormData } from '@/components/forms'
import { SegmentedTabs, segmentedTabId, segmentedTabPanelId } from '@/components/ui/SegmentedTabs'
import {
  LoginCard,
  AccountLockedCard,
  AlreadyLoggedInCard,
  IpNotAllowedCard,
  TwoFactorCodeCard,
  useAuth,
} from '@/features/auth'
// Module paths rather than the `@/features/appLogin` barrel: that barrel also
// carries the profile section and the admin views, which the login chunk does
// not need.
import { AppApprovalCard } from '@/features/appLogin/components/AppApprovalCard'
import { AppApprovalEntry } from '@/features/appLogin/components/AppApprovalEntry'
import { AppApprovalRequestCard } from '@/features/appLogin/components/AppApprovalRequestCard'
import { AppQrLoginCard } from '@/features/appLogin/components/AppQrLoginCard'
import { useAppApprovalConfig, useLoginApproval } from '@/features/appLogin/hooks/useLoginApproval'
import {
  QR_RESTART_COOLDOWN_MS,
  hasAppSecondFactor,
  qrRestartAt,
} from '@/features/appLogin/lib/approval'
import type { LoginApprovalPhase } from '@/features/appLogin/lib/approvalSession'
import { useAuthStore } from '@/stores/authStore'

/** The 2FA challenge the store holds right now, when it offers the phone. */
function appSecondFactorToken(): string | null {
  const state = useAuthStore.getState()
  return state.errorState === 'TWO_FACTOR_REQUIRED' &&
    state.twoFactorToken &&
    hasAppSecondFactor(state.twoFactorMethods)
    ? state.twoFactorToken
    : null
}

/** The tabs above the password form while the stand offers the QR (story 19.17). */
type LoginMethod = 'password' | 'qr'
const METHOD_TABS_ID = 'login-method'

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const {
    isLoading,
    error,
    errorState,
    lockoutMinutes,
    twoFactorToken,
    twoFactorUsername,
    twoFactorMethods,
    login,
    forceLogin,
    verifyTwoFactor,
    cancelTwoFactor,
    completeAppLogin,
    failAppLogin,
    clearError,
  } = useAuth()

  // Epic 19: «confirm on the phone». The server decides what is offered — the
  // passwordless button from `/config`, the 2FA variant from `two_factor_methods`.
  const approvalConfig = useAppApprovalConfig()
  const passwordlessOffered = approvalConfig.data?.passwordless === true
  /** The passwordless flow replaces the password form. */
  const [passwordless, setPasswordless] = useState(false)
  const [passwordlessUsername, setPasswordlessUsername] = useState('')
  /** The 2FA challenge for which the person chose the Google Authenticator code. */
  const [totpChosenFor, setTotpChosenFor] = useState<string | null>(null)
  /** «QR-код» tab — `/config` answers `qr: true` only while the stand has the mode on. */
  const [method, setMethod] = useState<LoginMethod>('password')
  /** `/qr` answered as a missing route after all: no tab until the page reloads. */
  const [qrWithdrawn, setQrWithdrawn] = useState(false)
  const qrOffered = approvalConfig.data?.qr === true && !qrWithdrawn
  /**
   * No QR request before this `Date.now()`: at most one per 5 s (board #1580 AC3),
   * however it is asked for — «Новий код» or opening the tab again. Kept here,
   * not in the card, because leaving the tab unmounts the card.
   */
  const [qrNotBefore, setQrNotBefore] = useState(0)
  /** A 429 of `/qr` kept across a tab switch: coming back shows it instead of asking again. */
  const [qrHeld, setQrHeld] = useState<LoginApprovalPhase | null>(null)
  /** The tab reopened within the 5 s: its request starts when they are over. */
  const qrDeferredRef = useRef<number | null>(null)

  const approval = useLoginApproval({
    client: 'crm_web',
    onApproved: completeAppLogin,
    onRefused: (refusal) => {
      // The login screen's own cards (account locked, IP not allowed) or the
      // message under the password form — the same as a refused `/login`.
      setPasswordless(false)
      setMethod('password')
      failAppLogin(refusal)
    },
    onUnavailable: (reset) => {
      if (method === 'qr') {
        // The stand switched the QR mode off: back to the password form, no tab.
        reset()
        setQrWithdrawn(true)
        setMethod('password')
        return
      }
      // No phone to ask any more: the 2FA step falls back to the TOTP code.
      const token = appSecondFactorToken()
      if (token) setTotpChosenFor(token)
    },
  })

  const clearDeferredQr = () => {
    if (qrDeferredRef.current !== null) {
      window.clearTimeout(qrDeferredRef.current)
      qrDeferredRef.current = null
    }
  }

  useEffect(() => {
    const deferred = qrDeferredRef
    return () => {
      if (deferred.current !== null) window.clearTimeout(deferred.current)
    }
  }, [])

  /** Every QR request goes through here, and so through the 5-second limit. */
  const openQr = () => {
    clearDeferredQr()
    setQrHeld(null)
    setQrNotBefore(Date.now() + QR_RESTART_COOLDOWN_MS)
    approval.start({ qr: true })
  }

  /** The phase the QR tab draws: a held 429 while nothing new was asked. */
  const qrPhase = approval.phase.kind === 'idle' && qrHeld ? qrHeld : approval.phase

  /** «Новий код» / «Спробувати ще раз» — the card also waits, this is the page's own check. */
  const restartQr = () => {
    if (Date.now() < qrRestartAt(qrNotBefore, qrPhase)) return
    openQr()
  }

  /** A tab switch comes from a click; opening the QR tab is what asks for a QR. */
  const selectMethod = (next: LoginMethod) => {
    if (next === method) return
    if (method === 'qr' && (qrPhase.kind === 'rateLimited' || qrPhase.kind === 'blocked')) {
      setQrHeld(qrPhase)
    }
    clearDeferredQr()
    approval.cancel()
    clearError()
    setMethod(next)
    if (next !== 'qr') return
    const now = Date.now()
    // A 429 still running: show it again, a request would only earn another one.
    if (qrHeld && now < qrRestartAt(0, qrHeld)) return
    setQrHeld(null)
    if (now < qrNotBefore) {
      qrDeferredRef.current = window.setTimeout(openQr, qrNotBefore - now)
      return
    }
    openQr()
  }

  /** Every start comes from a click; the phone is asked as soon as `/login` offers it. */
  const askPhoneIfOffered = () => {
    const token = appSecondFactorToken()
    if (token) approval.start({ two_factor_token: token })
  }

  const handleLogin = async (data: LoginFormData) => {
    approval.cancel()
    await login(data)
    askPhoneIfOffered()
  }

  const handleForceLogin = async () => {
    await forceLogin()
    askPhoneIfOffered()
  }

  const leavePasswordless = () => {
    approval.cancel()
    setPasswordless(false)
  }

  const renderAuthCard = () => {
    switch (errorState) {
      case 'ACCOUNT_LOCKED':
        return <AccountLockedCard lockoutMinutes={lockoutMinutes} onBackToLogin={clearError} />

      case 'ALREADY_LOGGED_IN':
        return (
          <AlreadyLoggedInCard
            onForceLogout={handleForceLogin}
            onCancel={clearError}
            isLoading={isLoading}
          />
        )

      case 'IP_NOT_ALLOWED':
        return <IpNotAllowedCard onBackToLogin={clearError} />

      case 'TWO_FACTOR_REQUIRED': {
        const phoneOffered = hasAppSecondFactor(twoFactorMethods) && twoFactorToken !== null
        if (phoneOffered && totpChosenFor !== twoFactorToken) {
          return (
            <AppApprovalCard
              phase={approval.phase}
              mode="second_factor"
              username={twoFactorUsername}
              onCancel={() => {
                approval.cancel()
                cancelTwoFactor()
              }}
              onResend={approval.resend}
              onFallback={() => {
                approval.cancel()
                setTotpChosenFor(twoFactorToken)
              }}
            />
          )
        }
        return (
          <TwoFactorCodeCard
            username={twoFactorUsername}
            onSubmit={verifyTwoFactor}
            onCancel={cancelTwoFactor}
            isLoading={isLoading}
            error={error}
            onUseApp={
              phoneOffered
                ? () => {
                    setTotpChosenFor(null)
                    approval.start({ two_factor_token: twoFactorToken })
                  }
                : undefined
            }
          />
        )
      }

      default:
        if (passwordless) {
          return approval.phase.kind === 'idle' ? (
            <AppApprovalRequestCard
              initialUsername={passwordlessUsername}
              onSubmit={(username) => {
                setPasswordlessUsername(username)
                approval.start({ username })
              }}
              onUsePassword={leavePasswordless}
            />
          ) : (
            <AppApprovalCard
              phase={approval.phase}
              mode="passwordless"
              onCancel={approval.cancel}
              onResend={approval.resend}
              onFallback={leavePasswordless}
            />
          )
        }
        return renderMethods(
          <LoginCard
            onSubmit={handleLogin}
            isLoading={isLoading}
            error={error}
            footer={
              passwordlessOffered ? (
                <AppApprovalEntry
                  onClick={() => {
                    clearError()
                    setPasswordless(true)
                  }}
                  disabled={isLoading}
                />
              ) : undefined
            }
          />
        )
    }
  }

  /** Without `qr: true` the password form stays exactly as it was: no tabs. */
  const renderMethods = (loginCard: ReactNode) => {
    if (!qrOffered) return loginCard
    return (
      <div className="w-full">
        <SegmentedTabs<LoginMethod>
          idPrefix={METHOD_TABS_ID}
          items={[
            { id: 'password', label: t('appLogin.qr.tabs.password'), className: 'sm:flex-1' },
            { id: 'qr', label: t('appLogin.qr.tabs.qr'), className: 'sm:flex-1' },
          ]}
          value={method}
          onChange={selectMethod}
          // Opening the QR tab spends one of 20 QR requests per 10 min from this address.
          activation="manual"
          ariaLabel={t('appLogin.qr.tabs.label')}
          className="mb-4 sm:mb-6 sm:w-full"
        />
        <div
          role="tabpanel"
          id={segmentedTabPanelId(METHOD_TABS_ID, method)}
          aria-labelledby={segmentedTabId(METHOD_TABS_ID, method)}
        >
          {method === 'qr' ? (
            <AppQrLoginCard phase={qrPhase} onRestart={restartQr} notBefore={qrNotBefore} />
          ) : (
            loginCard
          )}
        </div>
      </div>
    )
  }

  return <AuthLayout>{renderAuthCard()}</AuthLayout>
}
