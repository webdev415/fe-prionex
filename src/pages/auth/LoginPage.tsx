import { AuthLayout } from '@/components/layout'
import { LoginCard, AccountLockedCard, AlreadyLoggedInCard, useAuth } from '@/features/auth'

export default function LoginPage() {
  const { isLoading, error, errorState, lockoutMinutes, login, forceLogin, clearError } = useAuth()

  // Render appropriate card based on error state
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

      default:
        return <LoginCard onSubmit={login} isLoading={isLoading} error={error} />
    }
  }

  return <AuthLayout>{renderAuthCard()}</AuthLayout>
}
