import { AuthLayout } from '@/components/layout'
import {
  LoginCard,
  AccountLockedCard,
  AlreadyLoggedInCard,
  IpNotAllowedCard,
  TwoFactorCodeCard,
  useAuth,
} from '@/features/auth'

export default function LoginPage() {
  const {
    isLoading,
    error,
    errorState,
    lockoutMinutes,
    twoFactorUsername,
    login,
    forceLogin,
    verifyTwoFactor,
    cancelTwoFactor,
    clearError,
  } = useAuth()

  const renderAuthCard = () => {
    switch (errorState) {
      case 'ACCOUNT_LOCKED':
        return <AccountLockedCard lockoutMinutes={lockoutMinutes} onBackToLogin={clearError} />

      case 'ALREADY_LOGGED_IN':
        return (
          <AlreadyLoggedInCard
            onForceLogout={forceLogin}
            onCancel={clearError}
            isLoading={isLoading}
          />
        )

      case 'IP_NOT_ALLOWED':
        return <IpNotAllowedCard onBackToLogin={clearError} />

      case 'TWO_FACTOR_REQUIRED':
        return (
          <TwoFactorCodeCard
            username={twoFactorUsername}
            onSubmit={verifyTwoFactor}
            onCancel={cancelTwoFactor}
            isLoading={isLoading}
            error={error}
          />
        )

      default:
        return <LoginCard onSubmit={login} isLoading={isLoading} error={error} />
    }
  }

  return <AuthLayout>{renderAuthCard()}</AuthLayout>
}
