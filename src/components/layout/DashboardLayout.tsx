import { type ReactNode, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth'
import { useAuthStore } from '@/stores/authStore'
import { usePermissionRefresh } from '@/hooks'
import { ImpersonationBanner } from '@/features/auth/components/ImpersonationBanner'
import { LogoutConfirmationModal } from './LogoutConfirmationModal'
import { Sidebar, type SidebarItem, type SidebarAction } from './Sidebar'
import { SearchBar } from './SearchBar'
import { UserProfile } from './UserProfile'
import { PERMISSIONS } from '@/constants/permissions'
import type { Permission } from '@/constants/permissions'

interface DashboardLayoutProps {
  children: ReactNode
}

// Extend SidebarItem interface to support permission checking
interface ExtendedSidebarItem extends SidebarItem {
  requiredPermission?: Permission
  requiredPermissions?: Permission[]
  mode?: 'any' | 'all'
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
  const { logout, isImpersonating, impersonatedUser, exitImpersonation } = useAuth()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isExitingImpersonation, setIsExitingImpersonation] = useState(false)

  // Automatically refresh permissions every 5 minutes
  usePermissionRefresh()

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

  const handleExitImpersonation = async () => {
    setIsExitingImpersonation(true)
    try {
      await exitImpersonation()
      toast.success('Exited impersonation mode')
    } catch (error: unknown) {
      console.error('Failed to exit impersonation:', error)
      const err = error as { message?: string }
      toast.error(err.message || 'Failed to exit impersonation')
    } finally {
      setIsExitingImpersonation(false)
    }
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

  const user = useAuthStore((state) => state.user)

  // useMemo prevents unnecessary re-filtering on every render
  // Only recalculates when user permissions change
  const navItems: SidebarItem[] = useMemo(() => {
    // All navigation items with required permissions
    const allNavItems: ExtendedSidebarItem[] = [
      { path: '/dashboard', icon: 'home-04', label: 'Dashboard' },
      { path: '/dashboard', icon: 'activity-01', label: 'Activity', disabled: true }, // Route doesn't exist
      {
        path: '/dashboard/importclients',
        icon: 'file-import',
        label: 'Import Clients',
        requiredPermission: PERMISSIONS.DATA.IMPORT_DATA,
      },
      {
        path: '/dashboard/projects',
        icon: 'chart-ring',
        label: 'Projects',
        requiredPermission: PERMISSIONS.PROJECTS.MANAGE,
      },
      {
        path: '/dashboard/users',
        icon: 'community',
        label: 'Users',
        requiredPermission: PERMISSIONS.USERS.VIEW,
      },
      {
        path: '/dashboard/roles',
        icon: 'user-status',
        label: 'Roles',
        requiredPermission: PERMISSIONS.SYSTEM.MANAGE_ROLES,
      },
      { path: '/dashboard', icon: 'transaction-history', label: 'Transactions', disabled: true }, // Route doesn't exist
    ]

    return allNavItems.filter((item) => {
      // Always show disabled items (for visual consistency)
      if (item.disabled) return true

      // No permission required - show to all users
      if (!item.requiredPermission && !item.requiredPermissions) return true

      // Check single permission
      if (item.requiredPermission) {
        return user?.permissions?.includes(item.requiredPermission) ?? false
      }

      // Check multiple permissions
      if (item.requiredPermissions && item.requiredPermissions.length > 0) {
        if (item.mode === 'any') {
          // User needs at least one of the permissions
          return (
            item.requiredPermissions.some((p: Permission) => user?.permissions?.includes(p)) ??
            false
          )
        } else {
          // User needs all of the permissions (default)
          return (
            item.requiredPermissions.every((p: Permission) => user?.permissions?.includes(p)) ??
            false
          )
        }
      }

      // Default: show the item
      return true
    })
  }, [user?.permissions])

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

      {/* Fixed Impersonation Banner at Bottom */}
      {isImpersonating && impersonatedUser && (
        <div className="fixed right-0 bottom-6 left-0 z-50">
          <ImpersonationBanner
            isImpersonating={isImpersonating}
            impersonatedUser={impersonatedUser}
            onExitImpersonation={handleExitImpersonation}
            isLoading={isExitingImpersonation}
          />
        </div>
      )}

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
