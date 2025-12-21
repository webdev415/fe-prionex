import { type ReactNode, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import { useAuthStore } from '@/stores/authStore'
import { usePermissionRefresh } from '@/hooks'
import { ImpersonationBanner } from '@/features/auth/components/ImpersonationBanner'
import { LogoutConfirmationModal } from './LogoutConfirmationModal'
import { Sidebar, type SidebarItem } from './Sidebar'
import { SearchBar } from './SearchBar'
import { UserProfile } from './UserProfile'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ProjectSelector } from './ProjectSelector'
import { PERMISSIONS } from '@/constants/permissions'
import type { Permission } from '@/constants/permissions'
import { SearchResults, type SearchResult } from '@/components/ui/SearchResults'
import { useNavigate } from 'react-router-dom'

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
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { logout, isImpersonating, impersonatedUser, exitImpersonation } = useAuth()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isExitingImpersonation, setIsExitingImpersonation] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState('phone')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Automatically refresh permissions every 5 minutes
  usePermissionRefresh()

  const handleLogoutClick = useCallback(() => {
    setShowLogoutModal(true)
  }, [])

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
      toast.success(t('pages.users.messages.exitedImpersonation'))
    } catch (error: unknown) {
      console.error('Failed to exit impersonation:', error)
      const err = error as { message?: string }
      toast.error(err.message || t('pages.users.messages.failedToExitImpersonation'))
    } finally {
      setIsExitingImpersonation(false)
    }
  }

  const handleSearch = useCallback(
    async (query: string, type: string) => {
      // Clear results immediately when query is empty
      if (!query.trim()) {
        setSearchQuery('')
        setSearchResults([])
        setIsSearching(false)
        setSearchError(null)
        return
      }

      // Only search if query or type actually changed
      if (query === searchQuery && type === searchType && searchResults.length > 0) {
        return
      }

      setSearchQuery(query)
      setSearchType(type)

      setIsSearching(true)
      setSearchError(null)

      try {
        // TODO: Replace with actual API call
        // const response = await searchApi.searchClients(query, type)
        // setSearchResults(response.data)

        // Search through mock clients data
        await new Promise((resolve) => setTimeout(resolve, 300))

        // Import mock clients dynamically to avoid circular dependency
        const { mockClients } = await import('@/pages/ClientManagement/mockClients')

        const queryLower = query.toLowerCase().trim()
        const phoneRegex = /[\s\-()]/g
        const queryNormalized = queryLower.replace(phoneRegex, '')

        const results: SearchResult[] = mockClients
          .filter((client) => {
            switch (type) {
              case 'phone': {
                // Search by phone number (remove spaces and special chars for comparison)
                const phoneNormalized = client.phoneNumber.replace(phoneRegex, '').toLowerCase()
                return phoneNormalized.includes(queryNormalized)
              }
              case 'username':
              case 'email': {
                // For username/email, search in full name and tax ID (as we don't have email/username fields)
                return (
                  client.fullName.toLowerCase().includes(queryLower) ||
                  client.taxIdNumber.toLowerCase().includes(queryLower)
                )
              }
              default: {
                // Search in all fields
                return (
                  client.fullName.toLowerCase().includes(queryLower) ||
                  client.phoneNumber
                    .replace(phoneRegex, '')
                    .toLowerCase()
                    .includes(queryNormalized) ||
                  client.taxIdNumber.toLowerCase().includes(queryLower) ||
                  client.creditor.toLowerCase().includes(queryLower) ||
                  client.tags.some((tag: string) => tag.toLowerCase().includes(queryLower))
                )
              }
            }
          })
          .slice(0, 10) // Limit to 10 results for dropdown
          .map((client) => ({
            id: client.id,
            name: client.fullName,
            debt: client.debt,
            phone: client.phoneNumber,
            priority: client.priority as 'Critical' | 'High' | 'Medium' | 'Low',
            score: client.score,
          }))

        setSearchResults(results)
      } catch {
        setSearchError('Could not search clients. Please try again.')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [searchQuery, searchType, searchResults.length]
  )

  const handleSearchChange = useCallback(
    (query: string, type: string) => {
      handleSearch(query, type)
    },
    [handleSearch]
  )

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchQuery('')
        setSearchResults([])
        setIsSearching(false)
        setSearchError(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleResultClick = (result: SearchResult) => {
    // Navigate to client detail page or filter by this client
    navigate(`/dashboard/client?id=${result.id}`)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleViewAllResults = () => {
    // Navigate to client management page with search query
    navigate(`/dashboard/client?search=${encodeURIComponent(searchQuery)}&type=${searchType}`)
    setSearchQuery('')
    setSearchResults([])
  }

  // Search type options
  const searchOptions = [
    { value: 'phone', label: t('search.phoneNumber') },
    { value: 'email', label: t('search.email') },
    { value: 'username', label: t('search.username') },
  ]

  const user = useAuthStore((state) => state.user)

  // useMemo prevents unnecessary re-filtering on every render
  // Only recalculates when user permissions change
  const navItems: SidebarItem[] = useMemo(() => {
    // All navigation items with required permissions
    const allNavItems: ExtendedSidebarItem[] = [
      { path: '/dashboard/client', icon: 'home-04', label: t('navigation.dashboard') },
      { path: '/dashboard', icon: 'activity-01', label: t('navigation.activity'), disabled: true }, // Route doesn't exist
      {
        path: '/dashboard/import',
        icon: 'file-import',
        label: t('navigation.importClients'),
        requiredPermission: PERMISSIONS.DATA.IMPORT_DATA,
      },
      {
        path: '/dashboard/projects',
        icon: 'chart-ring',
        label: t('navigation.projects'),
        requiredPermission: PERMISSIONS.PROJECTS.MANAGE,
      },
      {
        path: '/dashboard/users',
        icon: 'community',
        label: t('navigation.users'),
        requiredPermission: PERMISSIONS.USERS.VIEW,
      },
      {
        path: '/dashboard/roles',
        icon: 'user-status',
        label: t('navigation.roles'),
        requiredPermission: PERMISSIONS.SYSTEM.MANAGE_ROLES,
      },
      {
        path: '/dashboard/sms-templates',
        icon: 'mail-send',
        label: t('navigation.smsTemplates'),
      },
      {
        path: '/dashboard',
        icon: 'transaction-history',
        label: t('navigation.transactions'),
        disabled: true,
      }, // Route doesn't exist
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
  }, [user?.permissions, t])

  return (
    <div className="bg-light-50 bg-dashboard-light min-h-screen bg-cover bg-center bg-no-repeat">
      {/* Sidebar */}
      <Sidebar
        items={navItems}
        onMenuClick={() => {
          // Handle menu click (e.g., toggle sidebar, open menu, etc.)
          console.log('Menu clicked')
        }}
      />

      {/* Main Content Area with left margin for sidebar */}
      <div className="ml-16">
        {/* Fixed Header */}
        <header className="bg-light-50 fixed top-0 right-0 left-16 z-20 flex h-[60px] items-center justify-between border-l border-white/10 px-6 shadow-sm">
          {/* Search Bar with Results */}
          <div className="relative" ref={searchContainerRef}>
            <SearchBar
              placeholder={t('search.placeholder')}
              searchOptions={searchOptions}
              defaultSearchType="phone"
              onSearch={handleSearch}
              onSearchChange={handleSearchChange}
              isLoading={isSearching}
            />
            {(isSearching ||
              searchResults.length > 0 ||
              searchError ||
              (searchQuery.trim() && !isSearching)) && (
              <SearchResults
                query={searchQuery}
                searchType={searchType}
                results={searchResults}
                isLoading={isSearching}
                error={searchError}
                onViewAll={handleViewAllResults}
                onResultClick={handleResultClick}
              />
            )}
          </div>

          {/* Right side: Project Selector, Language Switcher and User Profile */}
          <div className="flex items-center gap-3">
            <ProjectSelector />
            <LanguageSwitcher variant="dashboard" />
            <UserProfile onLogoutClick={handleLogoutClick} />
          </div>
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
