import { type ReactNode, useState } from 'react'
import { useAuth } from '@/features/auth'
import { Select } from '@/components/ui/Select'
import { LogoutConfirmationModal } from './LogoutConfirmationModal'
import { Sidebar, type SidebarItem, type SidebarAction } from './Sidebar'

interface DashboardLayoutProps {
  children: ReactNode
}

/**
 * DashboardLayout - Main application layout matching the dark teal/green design
 *
 * Features:
 * - Narrow icon-only sidebar (left)
 * - Header with search bar and user profile (top)
 * - Dark teal/green gradient background
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState('phone')
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

  // Search type options
  const searchOptions = [
    { value: 'phone', label: 'Phone number' },
    { value: 'email', label: 'Email' },
    { value: 'username', label: 'Username' },
  ]

  // Navigation items with Hugeicons
  const navItems: SidebarItem[] = [
    { path: '/dashboard', icon: 'home-04', label: 'Dashboard' },
    { path: '/activity', icon: 'activity-01', label: 'Activity' },
    { path: '/projects', icon: 'file-import', label: 'Projects' },
    { path: '/analytics', icon: 'analytics-01', label: 'Analytics' },
    { path: '/users', icon: 'community', label: 'Users' },
    { path: '/user-status', icon: 'user-status', label: 'User Status' },
    { path: '/transactions', icon: 'transaction-history', label: 'Transactions' },
  ]

  // Bottom action buttons
  const sidebarActions: SidebarAction[] = [
    {
      icon: 'setting-07',
      label: 'Settings',
      onClick: () => {
        // Navigate to settings or open settings modal
        console.log('Settings clicked')
      },
    },
    {
      icon: 'logout-square-01',
      label: 'Logout',
      onClick: handleLogoutClick,
    },
  ]

  return (
    <div
      className="min-h-screen bg-[#F2F3F0]"
      style={{
        backgroundImage: 'url(/assets/images/dashboard-light-bg.svg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Sidebar */}
      <Sidebar
        items={navItems}
        actions={sidebarActions}
        onMenuClick={() => {
          // Handle menu click (e.g., toggle sidebar, open menu, etc.)
          console.log('Menu clicked')
        }}
      />

      {/* Main Content Area with left margin for sidebar */}
      <div className="ml-16">
        {/* Fixed Header */}
        <header className="fixed top-0 right-0 left-16 z-20 flex items-center justify-between border-b border-gray-200 bg-white/80 px-6 py-4 backdrop-blur-sm">
          {/* Search Bar */}
          <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-48 bg-transparent text-sm text-gray-700 placeholder-gray-400 transition-colors outline-none focus:placeholder-gray-500"
            />
            <div className="h-5 w-px bg-gray-300" />
            <Select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              options={searchOptions}
              variant="ghost"
              className="min-w-[120px] text-gray-700"
            />
            <button
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#BBFB5B] transition-all duration-200 hover:scale-105 hover:bg-[#a8e84f]"
              aria-label="Search"
              onClick={() => console.log('Search:', searchQuery, searchType)}
            >
              <svg
                className="h-4 w-4 text-gray-900"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>

          {/* User Profile */}
          <button className="group flex items-center gap-2.5 rounded-full bg-[#BBFB5B] px-4 py-2.5 shadow-sm transition-all duration-200 hover:bg-[#a8e84f] hover:shadow-md">
            <svg
              className="h-5 w-5 text-gray-900"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="text-sm font-medium text-gray-900">
              {user?.username || 'Maria Ivanenko'}
            </span>
            <svg
              className="h-4 w-4 text-gray-900 transition-transform group-hover:translate-y-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </header>

        {/* Scrollable Page Content with top padding for fixed header */}
        <main className="min-h-screen overflow-y-auto px-6 pt-20 pb-6">{children}</main>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        open={showLogoutModal}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
        isLoading={isLoggingOut}
      />
    </div>
  )
}

export default DashboardLayout
