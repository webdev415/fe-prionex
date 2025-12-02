import { type ReactNode } from 'react'
import { useAuth } from '@/features/auth'
import { Button } from '@/components/ui'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout, isLoading } = useAuth()

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="bg-dark-900 flex w-64 flex-col text-white">
        {/* Logo */}
        <div className="border-dark-700 border-b p-4">
          <img src="/assets/images/logo.png" alt="Prionex" className="h-8" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <a
                href="/dashboard"
                className="bg-dark-700 flex items-center gap-3 rounded-lg px-3 py-2 text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Dashboard
              </a>
            </li>
          </ul>
        </nav>

        {/* User section */}
        <div className="border-dark-700 border-t p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="bg-dark-600 flex h-10 w-10 items-center justify-center rounded-full">
              <span className="text-sm font-medium">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.username || 'User'}</p>
              <p className="truncate text-xs text-gray-400">{user?.active_role_name || 'Role'}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={logout}
            isLoading={isLoading}
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}

export default DashboardLayout
