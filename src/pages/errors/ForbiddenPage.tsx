import { useNavigate, useLocation } from 'react-router-dom'
import { useUserRole, useUserPermissions } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { MdShield } from 'react-icons/md'
import { IoArrowBack, IoHome, IoAlertCircle } from 'react-icons/io5'

/**
 * Enhanced Forbidden (403) page shown when user lacks permissions
 *
 * Features:
 * - Clear explanation of what happened
 * - Shows user's current role
 * - Helpful guidance on what to do next
 * - Navigation options to go back or home
 * - Contact support option
 */
export function ForbiddenPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const roleName = useUserRole()
  const permissions = useUserPermissions()
  const user = useAuthStore((state) => state.user)

  // Get the page user tried to access from location state
  const fromPath = location.state?.from?.pathname || 'this page'

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/dashboard')
    }
  }

  const handleGoHome = () => {
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        {/* Icon and Title */}
        <div className="text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
            <MdShield className="h-12 w-12 text-red-600" aria-hidden="true" />
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900">Access Denied</h1>

          <p className="mt-4 text-lg text-gray-600">
            You don't have permission to access{' '}
            {fromPath === 'this page' ? fromPath : `"${fromPath}"`}
          </p>
        </div>

        {/* Explanation Card */}
        <div className="mt-8 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-start gap-3">
            <IoAlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">Why am I seeing this?</h2>
              <p className="mt-2 text-sm text-gray-600">
                Your current role (
                <span className="font-medium text-gray-900">{roleName || 'No role assigned'}</span>)
                doesn't include the permissions needed to view or perform actions on this page.
              </p>
            </div>
          </div>

          {/* User Info */}
          <div className="mt-6 space-y-3 border-t border-gray-200 pt-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Your username:</span>
              <span className="font-medium text-gray-900">{user?.username || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Your role:</span>
              <span className="font-medium text-gray-900">{roleName || 'No role assigned'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Active permissions:</span>
              <span className="font-medium text-gray-900">
                {permissions.length > 0 ? `${permissions.length} permissions` : 'None'}
              </span>
            </div>
          </div>

          {/* What to do */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900">What can I do?</h3>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-400">•</span>
                <span>Contact your project administrator or supervisor to request access</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-400">•</span>
                <span>Go back to the previous page or return to the dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-400">•</span>
                <span>If you believe this is an error, contact technical support</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={handleGoBack}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            <IoArrowBack className="h-4 w-4" />
            Go Back
          </button>

          <button
            onClick={handleGoHome}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          >
            <IoHome className="h-4 w-4" />
            Go to Dashboard
          </button>
        </div>

        {/* Support Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <a
              href="mailto:support@prionex.com"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForbiddenPage
