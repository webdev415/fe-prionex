import { type ReactNode, useState } from 'react'
import { useAuth } from '@/features/auth'
import { LogoutConfirmationModal } from './LogoutConfirmationModal'
import { Sidebar, type SidebarItem, type SidebarAction } from './Sidebar'
import { SearchBar } from './SearchBar'
import { UserProfile } from './UserProfile'

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
  const { logout } = useAuth()
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

  const handleSearch = (_query: string, _searchType: string) => {
    // TODO: Implement search functionality
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
    { path: '/roles', icon: 'user-status', label: 'Roles' },
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
      className="bg-light-50 min-h-screen"
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
        <header
          className="bg-light-50 fixed top-0 right-0 left-16 z-20 flex h-[60px] items-center justify-between px-6"
          style={{
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.1), 0px 1px 2px 0px rgba(0, 0, 0, 0.06)',
          }}
        >
          {/* Search Bar */}
          <SearchBar
            placeholder="Search"
            searchOptions={searchOptions}
            defaultSearchType="phone"
            onSearch={handleSearch}
          />

          {/* User Profile */}
          <UserProfile onLogoutClick={handleLogoutClick} />
        </header>

        {/* Scrollable Page Content with top padding for fixed header */}
        <main className="min-h-screen overflow-y-auto px-[28px] pt-[80px] pb-[20px]">
          {children}
        </main>
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
