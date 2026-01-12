import { type ReactNode, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import { useAuthStore } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { usePermissionRefresh } from '@/hooks'
import { ImpersonationBanner } from '@/features/auth/components/ImpersonationBanner'
import { LogoutConfirmationModal } from './LogoutConfirmationModal'
import { Sidebar, type SidebarItem } from './Sidebar'
import { SearchBar } from './SearchBar'
import { UserProfile } from './UserProfile'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ProjectSelector } from './ProjectSelector'
import { MinimizedCallBubble } from './MinimizedCallBubble'
import { PERMISSIONS } from '@/constants/permissions'
import type { Permission } from '@/constants/permissions'
import { SearchResults, type SearchResult } from '@/components/ui/SearchResults'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from '@/lib/i18n'
import { useCallStore } from '@/stores/callStore'
import { CallDialogModal } from '@/pages/ClientManagement/components/CallDialogModal'
import { CallRecordingModal } from '@/pages/ClientManagement/components/CallRecordingModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/DropdownMenu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

interface DashboardLayoutProps {
  children: ReactNode
}

// Extend SidebarItem interface to support permission checking
interface ExtendedSidebarItem extends SidebarItem {
  requiredPermission?: Permission
  requiredPermissions?: Permission[]
  mode?: 'any' | 'all'
}

// Mobile Header Menu Component - groups header actions into dropdown on mobile
function MobileHeaderMenu({ onLogoutClick }: { onLogoutClick?: () => void }) {
  const { t, i18n } = useTranslation('common')
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const { minimizedCall, clearMinimizedCall, setOpenCallModal } = useCallStore()
  const [isRestored, setIsRestored] = useState(false)

  const userProjects = user?.projects || []
  const hasMultipleProjects = userProjects.length > 1
  const currentProject = userProjects.find((p) => p.id === user?.active_project_id)
  const currentLanguage = i18n.language as 'en' | 'uk' | 'ru'

  // Display name
  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.username || 'User'

  // Close dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && isOpen) {
        setIsOpen(false)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  const handleProjectSwitch = async (projectId: string) => {
    if (projectId === user?.active_project_id) return
    try {
      const { authApi } = await import('@/features/auth/api/authApi')
      const projectIdNum = parseInt(projectId, 10)
      if (isNaN(projectIdNum)) {
        throw new Error('Invalid project ID')
      }
      const response = await authApi.switchProject(projectIdNum)
      const projectName =
        response.data.active_project?.project_name ||
        userProjects.find((p) => p.id === projectId)?.name ||
        'Project'
      toast.success(t('pages.users.messages.projectSwitched', { projectName }))
      // Reload page to refresh user data
      window.location.reload()
    } catch (error) {
      console.error('Failed to switch project:', error)
      toast.error(t('pages.users.messages.failedToSwitchProject'))
    }
  }

  const handleRestoreCall = () => {
    setIsRestored(true)
    setIsOpen(false) // Close dropdown when restoring call
  }

  const handleCloseCall = () => {
    setIsRestored(false)
    setOpenCallModal(null)
    clearMinimizedCall()
  }

  const handleMinimizeCall = () => {
    setIsRestored(false)
  }

  // Determine if call is active (dialing or connected) for styling
  const isActiveCall =
    minimizedCall?.type === 'call-dialog' &&
    (minimizedCall.callState === 'dialing' || minimizedCall.callState === 'connected')

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Get status color for call dialog
  const getStatusColor = () => {
    if (minimizedCall?.type === 'call-dialog') {
      if (minimizedCall.callState === 'connected') return 'bg-success-500'
      if (minimizedCall.callState === 'dialing') return 'bg-primary-500'
      if (minimizedCall.callState === 'ended') return 'bg-gray-500'
    }
    return 'bg-primary-500'
  }

  // Get status text
  const getStatusText = () => {
    if (minimizedCall?.type === 'call-dialog') {
      if (minimizedCall.callState === 'dialing') return t('pages.clients.modals.callDialog.calling')
      if (minimizedCall.callState === 'connected')
        return t('pages.clients.modals.callDialog.connected')
      if (minimizedCall.callState === 'ended') return t('pages.clients.modals.callDialog.callEnded')
      return t('pages.clients.modals.callDialog.callClient')
    }
    return t('pages.clients.modals.callRecording.title')
  }

  // Get tooltip content (same as original bubble button)
  const getTooltipContent = () => {
    if (!minimizedCall) return null

    if (minimizedCall.type === 'call-dialog') {
      return (
        <div className="flex min-w-[280px] flex-col gap-3">
          {/* Header with icon and title */}
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getStatusColor()}`}
            >
              <Icons.Headset size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="truncate text-sm font-semibold text-white">
                {minimizedCall.clientName}
              </div>
              <div className="text-xs text-gray-300">{minimizedCall.phoneNumber}</div>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
            <span className="text-xs font-medium text-white">{getStatusText()}</span>
          </div>

          {/* Call details */}
          <div className="flex flex-col gap-2 border-t border-gray-700 pt-2">
            {minimizedCall.callType && (
              <div className="flex items-center gap-2">
                <Icons.Phone size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300 capitalize">
                  {minimizedCall.callType.replace('-', ' ')}
                </span>
              </div>
            )}
            {minimizedCall.elapsedTime !== undefined && minimizedCall.elapsedTime > 0 && (
              <div className="flex items-center gap-2">
                <Icons.StopWatch size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">
                  {t('pages.clients.modals.callDialog.talkTime')}:{' '}
                  {formatTime(minimizedCall.elapsedTime)}
                </span>
              </div>
            )}
          </div>
        </div>
      )
    } else {
      // call-recording
      return (
        <div className="flex min-w-[280px] flex-col gap-3">
          {/* Header with icon and title */}
          <div className="flex items-center gap-3">
            <div className="bg-primary-500 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <Icons.Voice size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="truncate text-sm font-semibold text-white">
                {minimizedCall.callData?.clientName || minimizedCall.clientName}
              </div>
              <div className="text-xs text-gray-300">
                {minimizedCall.callData?.phone || minimizedCall.phoneNumber}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className="bg-primary-500 h-2 w-2 rounded-full" />
            <span className="text-xs font-medium text-white">
              {t('pages.clients.modals.callRecording.title')}
            </span>
          </div>

          {/* Call details */}
          <div className="flex flex-col gap-2 border-t border-gray-700 pt-2">
            {minimizedCall.callData?.type && (
              <div className="flex items-center gap-2">
                <Icons.Info size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">{minimizedCall.callData.type}</span>
              </div>
            )}
            {minimizedCall.callData?.operator && (
              <div className="flex items-center gap-2">
                <Icons.User size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">
                  {t('pages.clients.modals.callRecording.operator')}:{' '}
                  {minimizedCall.callData.operator}
                </span>
              </div>
            )}
            {minimizedCall.callData?.duration && (
              <div className="flex items-center gap-2">
                <Icons.StopWatch size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">
                  {t('pages.clients.modals.callRecording.duration')}:{' '}
                  {minimizedCall.callData.duration}
                </span>
              </div>
            )}
            {minimizedCall.callData?.date && minimizedCall.callData?.time && (
              <div className="flex items-center gap-2">
                <Icons.Calendar size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">
                  {minimizedCall.callData.date} {minimizedCall.callData.time}
                </span>
              </div>
            )}
          </div>
        </div>
      )
    }
  }

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="bg-secondary-800 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-white transition-colors hover:opacity-90 focus:outline-none lg:hidden"
          aria-label="Menu"
        >
          <Icons.User02 size={20} strokeWidth={1.5} className="text-primary-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white">
        {/* User Profile */}
        <DropdownMenuItem disabled className="text-dark-500 text-sm">
          <Icons.User02 size={16} className="mr-2" />
          <span className="truncate">{displayName}</span>
        </DropdownMenuItem>

        {/* Minimized Call Bubble (if call is minimized) */}
        {minimizedCall && (
          <>
            <DropdownMenuSeparator />
            <TooltipProvider>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    onClick={handleRestoreCall}
                    className={cn(
                      'bg-secondary-800 relative flex cursor-pointer items-center rounded-md px-3 py-2 text-sm transition-all duration-200',
                      'hover:bg-secondary-800 hover:scale-101 hover:opacity-90',
                      'focus:bg-secondary-800 focus:text-white',
                      'data-[highlighted]:bg-secondary-800 data-[highlighted]:text-white',
                      isActiveCall ? 'animate-pulse' : 'animate-[pulse_3s_ease-in-out_infinite]'
                    )}
                  >
                    <Icons.HeadsetConnected
                      size={16}
                      className={cn(
                        'mr-2 text-white transition-transform duration-300',
                        isActiveCall ? 'animate-pulse' : ''
                      )}
                      strokeWidth={1.5}
                    />
                    <span className="flex-1 truncate text-white">
                      {minimizedCall.type === 'call-dialog'
                        ? t('pages.clients.modals.callDialog.callClient')
                        : t('pages.clients.modals.callRecording.title')}
                    </span>
                    {/* Active call indicator dot */}
                    {isActiveCall && (
                      <>
                        <span className="bg-success-500 border-secondary-800 absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-ping rounded-full border-2" />
                        <span className="bg-success-500 border-secondary-800 absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2" />
                      </>
                    )}
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={8}
                  className="max-w-sm border border-gray-700 bg-gray-900 p-4 shadow-xl"
                >
                  {getTooltipContent()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}

        {/* Project Selector (if multiple projects) */}
        {hasMultipleProjects && currentProject && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-dark-500 text-sm">
                <Icons.Brochure size={16} className="mr-2" />
                <span>{currentProject.name}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-white">
                {userProjects.map((project) => {
                  const isActive = project.id === user?.active_project_id
                  const projectRole = project.roles?.[0]

                  return (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => void handleProjectSwitch(project.id)}
                      disabled={isActive}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
                        isActive ? 'text-primary-600 font-medium' : 'text-gray-700'
                      )}
                    >
                      <span className="flex-1 truncate">{project.name}</span>
                      {projectRole && (
                        <span className="text-xs text-gray-500">({projectRole.name})</span>
                      )}
                      {isActive && (
                        <Icons.Checkmark
                          size={16}
                          className="text-dark-500 ml-auto"
                          strokeWidth={2}
                        />
                      )}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        {/* Language Switcher */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-dark-500 text-sm">
            <Icons.LanguageSquare size={16} className="mr-2" />
            <span>{LANGUAGE_NAMES[currentLanguage] || currentLanguage}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="bg-white">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = i18n.language === lang

              return (
                <DropdownMenuItem
                  key={lang}
                  onClick={() => i18n.changeLanguage(lang)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
                    isActive ? 'text-primary-600 font-medium' : 'text-gray-700'
                  )}
                >
                  <span>{LANGUAGE_NAMES[lang]}</span>
                  {isActive && (
                    <Icons.Checkmark size={16} className="text-dark-500 ml-auto" strokeWidth={2} />
                  )}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Settings */}
        <DropdownMenuItem
          onClick={() => {
            toast.info(t('navigation.settings'))
          }}
          className="text-dark-500 text-sm"
        >
          <Icons.Setting07 size={16} className="mr-2" />
          <span>{t('navigation.settings')}</span>
        </DropdownMenuItem>

        {/* Logout */}
        <DropdownMenuItem onClick={onLogoutClick} className="text-dark-500 text-sm">
          <Icons.Logout size={16} className="mr-2" />
          <span>{t('actions.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Restore call modals */}
      {isRestored && minimizedCall?.type === 'call-dialog' && (
        <CallDialogModal
          open={isRestored}
          onClose={handleCloseCall}
          onMinimize={handleMinimizeCall}
          clientName={minimizedCall.clientName}
          phoneNumber={minimizedCall.phoneNumber}
          initialState={minimizedCall.callState || 'initial'}
        />
      )}

      {isRestored && minimizedCall?.type === 'call-recording' && minimizedCall.callData && (
        <CallRecordingModal
          open={isRestored}
          onClose={handleCloseCall}
          onMinimize={handleMinimizeCall}
          callData={minimizedCall.callData}
        />
      )}
    </DropdownMenu>
  )
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
  const isOpenSideBar = useSidebarStore((state) => state.isOpenSideBar)

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
    navigate(`/dashboard?id=${result.id}`)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleViewAllResults = () => {
    // Navigate to client management page with search query
    navigate(`/dashboard?search=${encodeURIComponent(searchQuery)}&type=${searchType}`)
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
      { path: '/dashboard', icon: 'home-04', label: t('navigation.dashboard') },
      { path: '/dashboard', icon: 'activity-01', label: t('navigation.activity'), disabled: true }, // Route doesn't exist
      {
        path: '/dashboard/import',
        icon: 'file-import',
        label: t('navigation.importClients'),
        requiredPermission: PERMISSIONS.DATA.IMPORT_DATA,
      },
      {
        path: '/dashboard/projects',
        icon: 'brochure',
        label: t('navigation.projects'),
        requiredPermission: PERMISSIONS.PROJECTS.MANAGE,
      },
      {
        path: '/dashboard/reports',
        icon: 'chart-ring',
        label: t('navigation.reports'),
        requiredPermission: PERMISSIONS.REPORTS.VIEW_ALL_REPORTS,
      },
      {
        path: '/dashboard/users',
        icon: 'user-search-01',
        label: t('navigation.users'),
        requiredPermission: PERMISSIONS.USERS.VIEW,
      },
      {
        path: '/dashboard/sellers',
        icon: 'user-multiple',
        label: t('navigation.sellers'),
      },
      {
        path: '/dashboard/roles',
        icon: 'user-circle-02',
        label: t('navigation.roles'),
        requiredPermission: PERMISSIONS.SYSTEM.MANAGE_ROLES,
      },
      {
        path: '/dashboard/audit-logs',
        icon: 'transaction-history',
        label: t('navigation.auditLogs'),
      },
      {
        path: '/dashboard/sms-templates',
        icon: 'mail',
        label: t('navigation.smsTemplates'),
      },
      {
        path: '/dashboard/scoring-configuration',
        icon: 'checkmark-badge-02',
        label: t('navigation.scoringConfiguration'),
      },
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

  const { toggleSidebar } = useSidebarStore()

  return (
    <div className="bg-light-50 bg-dashboard-light min-h-screen bg-cover bg-center bg-no-repeat">
      {/* Sidebar */}
      <Sidebar items={navItems} />

      {/* Main Content Area with left margin for sidebar - no margin on mobile */}
      <div
        className={cn(
          'transition-all duration-300',
          'lg:ml-18', // Desktop: always has margin for collapsed sidebar
          isOpenSideBar && 'lg:ml-60' // Desktop: expanded sidebar
        )}
      >
        {/* Fixed Header */}
        <header
          className={cn(
            'bg-light-50 fixed top-0 right-0 z-20 flex h-[60px] items-center justify-between border-l border-white/10 px-3 shadow-sm transition-all duration-300 sm:px-4 lg:px-6',
            'left-0 lg:left-18', // Mobile: full width, Desktop: margin for collapsed sidebar
            isOpenSideBar && 'lg:left-60' // Desktop: expanded sidebar
          )}
        >
          {/* Left side: Menu button (mobile) + Search Bar */}
          <div className="relative flex items-center gap-2 lg:gap-3">
            {/* Mobile menu button */}
            <button
              onClick={toggleSidebar}
              className="focus:ring-primary-500 group flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus:ring-2 focus:ring-offset-2 focus:outline-none active:bg-gray-100 active:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
              aria-label="Toggle menu"
            >
              <Icons.Menu11
                size={20}
                className="text-gray-700 transition-transform duration-200 group-hover:scale-110"
                strokeWidth={1.5}
              />
            </button>

            {/* Search Bar with Results */}
            <div className="relative flex items-center gap-2" ref={searchContainerRef}>
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
          </div>

          {/* Right side: Desktop - individual buttons, Mobile - grouped dropdown */}
          {/* Desktop: Project Selector, Language Switcher and User Profile */}
          <div className="hidden items-center gap-3 lg:flex">
            <MinimizedCallBubble />
            <ProjectSelector />
            <LanguageSwitcher variant="dashboard" />
            <UserProfile onLogoutClick={handleLogoutClick} />
          </div>

          {/* Mobile: Tree dropdown with all actions */}
          <MobileHeaderMenu onLogoutClick={handleLogoutClick} />
        </header>

        {/* Scrollable Page Content with top padding for fixed header */}
        <main className="min-h-screen overflow-y-auto px-4 pt-[80px] pb-4 sm:px-6 sm:pb-6 lg:px-[28px] lg:pb-[20px]">
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
