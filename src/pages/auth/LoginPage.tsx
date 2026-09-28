import { useState } from 'react'
import { AuthLayout } from '@/components/layout'
import type { LoginFormData } from '@/components/forms'
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
import { useAppApprovalConfig, useLoginApproval } from '@/features/appLogin/hooks/useLoginApproval'
import { hasAppSecondFactor } from '@/features/appLogin/lib/approval'
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

export default function LoginPage() {
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

  const approval = useLoginApproval({
    client: 'crm_web',
    onApproved: completeAppLogin,
    onRefused: (refusal) => {
      // The login screen's own cards (account locked, IP not allowed) or the
      // message under the password form — the same as a refused `/login`.
      setPasswordless(false)
      failAppLogin(refusal)
    },
    onUnavailable: () => {
      // No phone to ask any more: the 2FA step falls back to the TOTP code.
      const token = appSecondFactorToken()
      if (token) setTotpChosenFor(token)
    },
  })

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
        return (
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

  return <AuthLayout>{renderAuthCard()}</AuthLayout>
}
