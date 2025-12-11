import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
import { LogoutConfirmationModal } from '@/components/layout/LogoutConfirmationModal'
import { useAuth } from '@/features/auth/hooks/useAuth'

/**
 * Forbidden (403) page shown when user lacks permissions
 *
 * Features:
 * - Clear explanation of what happened
 * - Navigation to dashboard
 * - Logout functionality with confirmation modal
 */
export function ForbiddenPage() {
  const navigate = useNavigate()
  const { logout, isAuthenticated } = useAuth()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogoutClick = () => {
    setShowLogoutModal(true)
  }

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      setIsLoggingOut(false)
      setShowLogoutModal(false)
    }
  }

  const handleLogoutCancel = () => {
    setShowLogoutModal(false)
  }

  const handleGoHome = () => {
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      {/* Access Denied */}
      <div
        className="flex h-[383px] w-[600px] items-center justify-center rounded-[12px] border bg-white"
        style={{
          marginLeft: '100px',
          padding: '24px',
        }}
      >
        <div className="flex h-[303px] w-[520px] flex-col items-center justify-between">
          <div className="h-[40px] w-full gap-1">
            <div
              className="flex h-full w-full items-center gap-4"
              style={{
                color: colors.neutral.dark[500],
                fontSize: '30px',
                fontWeight: 300,
              }}
            >
              <div className="bg-error-500 flex h-12 w-12 items-center justify-center rounded-full">
                <Icons.LockedIcon01 size={24} color="#FFFFFF" strokeWidth={2} />
              </div>
              <span
                className="font-bold"
                style={{
                  color: colors.neutral.dark[500],
                  fontSize: '30px',
                  fontWeight: 500,
                }}
              >
                Access Denied
              </span>
              <span className="font-light">(403)</span>
            </div>
          </div>

          <div
            className="font-size-14 flex h-[72px] w-full items-center justify-center gap-1 rounded-[8px] bg-white font-medium"
            style={{
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <Icons.Warning size={24} color="#EF4444" strokeWidth={2} />
            <p className="text-error-500 text-sm font-medium">
              You do not have permission to view this page or perform this action.
            </p>
          </div>

          <div
            className="font-weight-500 font-size-16 flex h-[50px] w-full items-center justify-center"
            style={{
              color: colors.neutral.dark[500],
              fontSize: '16px',
              fontWeight: 500,
            }}
          >
            <p className="text-neutral-dark-500 text-center text-base font-medium">
              If you believe this is a mistake, please contact your supervisor or administrator.
            </p>
          </div>

          {isAuthenticated && (
            <div className="flex h-[45px] w-full items-center justify-between gap-8">
              <button
                onClick={handleLogoutClick}
                className="h-[45px] w-[224px] rounded-lg bg-gray-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
              >
                Logout
              </button>
              <button
                onClick={handleGoHome}
                className="bg-primary-300 text-neutral-dark-500 h-[45px] w-[224px] rounded-lg px-6 py-3 text-sm font-medium transition-colors hover:opacity-90"
                style={{
                  backgroundColor: colors.primary[300],
                  color: colors.neutral.dark[500],
                }}
              >
                Go to Home
              </button>
            </div>
          )}
        </div>
      </div>

      <LogoutConfirmationModal
        open={showLogoutModal}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
        isLoading={isLoggingOut}
      />
    </div>
  )
}

export default ForbiddenPage
