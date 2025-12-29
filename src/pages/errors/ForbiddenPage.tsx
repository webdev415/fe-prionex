import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { LogoutConfirmationModal } from '@/components/layout/LogoutConfirmationModal'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/Button'

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
      <div className="ml-[100px] flex h-[383px] w-[600px] items-center justify-center rounded-[12px] border bg-white p-6">
        <div className="flex h-[303px] w-[520px] flex-col items-center justify-between">
          <div className="h-[40px] w-full gap-1">
            <div className="text-dark-500 flex h-full w-full items-center gap-4 text-[30px] font-light">
              <div className="bg-error-500 flex h-12 w-12 items-center justify-center rounded-full">
                <Icons.LockedIcon01 size={24} className="text-white" strokeWidth={2} />
              </div>
              <span className="text-dark-500 text-[30px] font-medium">Access Denied</span>
              <span className="font-light">(403)</span>
            </div>
          </div>

          <div className="flex h-[72px] w-full items-center justify-center gap-1 rounded-[8px] bg-white text-sm font-medium">
            <Icons.Warning size={24} className="text-error-500" strokeWidth={2} />
            <p className="text-error-500 text-sm font-medium">
              You do not have permission to view this page or perform this action.
            </p>
          </div>

          <div className="text-dark-500 flex h-[50px] w-full items-center justify-center text-base font-medium">
            <p className="text-dark-500 text-center text-base font-medium">
              If you believe this is a mistake, please contact your supervisor or administrator.
            </p>
          </div>

          {isAuthenticated && (
            <div className="flex h-[45px] w-full items-center justify-between gap-8">
              <Button
                variant="cancel"
                size="xl"
                onClick={handleLogoutClick}
                className="h-[45px] w-[224px]"
              >
                Logout
              </Button>
              <Button
                variant="primary"
                size="xl"
                onClick={handleGoHome}
                className="h-[45px] w-[224px]"
              >
                Go to Home
              </Button>
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
