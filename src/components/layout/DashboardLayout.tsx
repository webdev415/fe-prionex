import { type ReactNode, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import { useAuthStore } from '@/stores/authStore'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useSearchStore } from '@/stores/searchStore'
import { usePermissionRefresh } from '@/hooks'
import { ImpersonationBanner } from '@/features/auth/components/ImpersonationBanner'
import { LogoutConfirmationModal } from './LogoutConfirmationModal'
import { Sidebar, type SidebarItem, type SidebarSubItem } from './Sidebar'
import { SearchBar } from './SearchBar'
import { UserProfile } from './UserProfile'
import { MinimizedCallBubble } from './MinimizedCallBubble'
import { NotificationBell } from './NotificationBell'
import { PERMISSIONS } from '@/constants/permissions'
import type { Permission } from '@/constants/permissions'
import { SearchResults, type SearchResult } from '@/components/ui/SearchResults'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { useCallStore } from '@/stores/callStore'
import { CallDialogModal } from '@/pages/ClientManagement/components/CallDialogModal'
import { CallRecordingModal } from '@/pages/ClientManagement/components/CallRecordingModal'
import { useIncomingCall } from '@/features/calls/hooks/useIncomingCall'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { searchClients, mapPriorityLevel, type SearchType } from '@/api/clientSearchApi'

interface DashboardLayoutProps {
  children: ReactNode
}

function AiAssistantHeaderButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('common')
  const isActive = location.pathname === '/dashboard/ai-assistant'

  return (
    <button
      type="button"
      aria-label={t('pages.aiAssistant.headerButtonAria')}
      onClick={() => navigate('/dashboard/ai-assistant')}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gray-100 focus:outline-none',
        isActive && 'bg-gray-100'
      )}
    >
      <Icons.AiBrain03
        size={20}
        strokeWidth={1.5}
        className={cn('transition-colors', isActive ? 'text-primary-600' : 'text-gray-300')}
      />
    </button>
  )
}

// Extend SidebarItem interface to support permission checking
interface ExtendedSidebarItem extends SidebarItem {
  requiredPermission?: Permission
  requiredPermissions?: Permission[]
  mode?: 'any' | 'all'
  subItems?: (SidebarSubItem & {
    requiredPermission?: Permission
    requiredPermissions?: Permission[]
    mode?: 'any' | 'all'
  })[]
}

// Mobile Header Menu Component - groups header actions into dropdown on mobile
function MobileHeaderMenu({ onLogoutClick }: { onLogoutClick?: () => void }) {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const { minimizedCall, clearMinimizedCall, setOpenCallModal } = useCallStore()
  const [isRestored, setIsRestored] = useState(false)

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
      if (minimizedCall.callState === 'initial') return 'bg-gray-400'
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
      if (minimizedCall.callState === 'initial')
        return t('pages.clients.modals.callDialog.readyToCall')
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
              <div className="text-xs text-gray-300">
                {minimizedCall.displayPhone || minimizedCall.phoneNumber}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
            <span className="text-xs font-medium text-white">{getStatusText()}</span>
          </div>

          {/* Call details — hidden in 'initial' state since nothing has been committed yet */}
          {minimizedCall.callState !== 'initial' && (
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
          )}
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

        {/* Settings */}
        <DropdownMenuItem
          onClick={() => {
            setIsOpen(false)
            navigate('/dashboard/profile')
          }}
          className="text-dark-500 text-sm"
        >
          <Icons.SlidersHorizontal size={16} className="mr-2" />
          <span>{t('navigation.profile')}</span>
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
          callId={minimizedCall.callId}
          initialState={minimizedCall.callState || 'initial'}
          initialElapsedTime={minimizedCall.elapsedTime ?? 0}
          minimizedAt={
            minimizedCall.callState === 'dialing' || minimizedCall.callState === 'connected'
              ? minimizedCall.timestamp
              : undefined
          }
          initialCallType={minimizedCall.callType || 'white-line'}
          initialManualPhoneEnabled={minimizedCall.manualPhoneEnabled ?? false}
          initialManualPhoneDigits={minimizedCall.manualPhoneDigits ?? ''}
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
  const { t, i18n } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, isImpersonating, impersonatedUser, exitImpersonation } = useAuth()
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isExitingImpersonation, setIsExitingImpersonation] = useState(false)
  const isOpenSideBar = useSidebarStore((state) => state.isOpenSideBar)

  // Search state - separate local input state from applied store state
  // Local state: for the search input (updates as user types)
  // Store state: for the clients page (updates only on "View All Results")
  const { setSearchQuery: setAppliedSearchQuery, setSearchType: setAppliedSearchType } =
    useSearchStore()
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [localSearchType, setLocalSearchType] = useState('phone')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Close header search results when navigating so the panel cannot sit over other pages
  useEffect(() => {
    setShowSearchDropdown(false)
  }, [location.pathname])

  // Automatically refresh permissions every 5 minutes
  usePermissionRefresh()

  // Get agent extension from user for incoming call handling
  const { user: authUser } = useAuth()
  const agentExtension = authUser?.asterisk_extension || null

  // Handle incoming calls
  const { incomingCall, dismissIncomingCall } = useIncomingCall(agentExtension)

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
        setLocalSearchQuery('')
        setSearchResults([])
        setIsSearching(false)
        setSearchError(null)
        setShowSearchDropdown(false)
        return
      }

      // Same query/type with cached results (e.g. user closed dropdown by clicking away):
      // reopen the panel without blocking further explicit search actions.
      if (query === localSearchQuery && type === localSearchType && searchResults.length > 0) {
        setShowSearchDropdown(true)
        return
      }

      // Update local state only (not the store - that happens on "View All Results")
      setLocalSearchQuery(query)
      setLocalSearchType(type)

      setIsSearching(true)
      setSearchError(null)
      setShowSearchDropdown(true)

      try {
        // Map frontend search type to backend SearchType
        let backendSearchType: SearchType = 'all'
        if (type === 'phone') {
          backendSearchType = 'phone'
        } else if (type === 'name' || type === 'tin') {
          // Map name/tin to name search (backend name search includes TIN)
          backendSearchType = 'name'
        } else if (type === 'email') {
          backendSearchType = 'email'
        } else if (type === 'contract_number') {
          backendSearchType = 'contract_number'
        }

        // Call real API
        const response = await searchClients({
          q: query,
          search_type: backendSearchType,
          limit: 10,
        })

        // Transform backend response to frontend SearchResult format
        const results: SearchResult[] = response.items.map((item) => ({
          id: item.id,
          name: item.full_name,
          debt: item.total_debt,
          phone: item.phone_primary ?? '',
          email: item.email_primary ?? '',
          priority: mapPriorityLevel(item.priority_level),
          score: item.priority_score,
        }))

        setSearchResults(results)
      } catch (error) {
        console.error('Search error:', error)
        setSearchError(t('search.error'))
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [localSearchQuery, localSearchType, searchResults.length, t]
  )

  const handleSearchChange = useCallback(
    (query: string, type: string) => {
      handleSearch(query, type)
    },
    [handleSearch]
  )

  // Handle click outside to close search results dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        // Only close the dropdown, keep search query in store
        setShowSearchDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleResultClick = (result: SearchResult) => {
    // Navigate to client detail page
    navigate(`/dashboard/clients/${result.id}`)
    setLocalSearchQuery('')
    setSearchResults([])
    setShowSearchDropdown(false)
  }

  const handleViewAllResults = () => {
    // Apply the search to the store (this triggers the clients page to filter)
    setAppliedSearchQuery(localSearchQuery)
    setAppliedSearchType(localSearchType)
    // Navigate to client management page
    navigate('/dashboard')
    // Close dropdown but keep search query visible in input
    setSearchResults([])
    setShowSearchDropdown(false)
  }

  // Search type options
  const searchOptions = [
    { value: 'phone', label: t('search.phoneNumber') },
    { value: 'name', label: t('search.fullName') },
    { value: 'email', label: t('search.email') },
    { value: 'tin', label: t('search.tin') },
    { value: 'contract_number', label: t('search.contractNumber') },
  ]

  const user = useAuthStore((state) => state.user)

  // useMemo prevents unnecessary re-filtering on every render
  // Only recalculates when user permissions change
  const navItemsResult = useMemo(() => {
    // All navigation items with required permissions
    const allNavItems: ExtendedSidebarItem[] = [
      {
        path: '/dashboard',
        icon: 'home-04',
        label: t('navigation.dashboard'),
        requiredPermission: PERMISSIONS.CLIENTS.VIEW,
      },
      {
        path: '/dashboard/import',
        icon: 'file-import',
        label: t('navigation.import', 'Import'),
        subItems: [
          {
            path: '/dashboard/import',
            label: t('navigation.importClients'),
            icon: 'file-import',
            requiredPermission: PERMISSIONS.DATA.IMPORT,
          },
          {
            path: '/dashboard/operations/bulk-operator-assignment',
            label: t('navigation.bulkOperatorAssignment', 'Bulk Operator Assignment'),
            icon: 'user-multiple-02',
            requiredPermission: PERMISSIONS.CLIENTS.EDIT,
          },
          {
            path: '/dashboard/operations/bulk-payment-import',
            label: t('navigation.bulkPaymentImport', 'Bulk Payment Import'),
            icon: 'transaction-history',
            requiredPermission: PERMISSIONS.DATA.IMPORT_PAYMENTS,
          },
        ],
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
        requiredPermission: PERMISSIONS.SELLERS.VIEW,
      },
      {
        path: '/dashboard/roles',
        icon: 'user-circle-02',
        label: t('navigation.roles'),
        requiredPermission: PERMISSIONS.SYSTEM.MANAGE_ROLES,
      },
      {
        path: '/dashboard/departments',
        icon: 'briefcase-01',
        label: t('navigation.departments'),
        requiredPermission: PERMISSIONS.SYSTEM.MANAGE_ROLES,
      },
      {
        path: '/dashboard/audit-logs',
        icon: 'transaction-history',
        label: t('navigation.auditLogs'),
        requiredPermission: PERMISSIONS.SYSTEM.VIEW_AUDIT_LOGS,
      },
      {
        path: '/dashboard/system-settings',
        icon: 'setting-07',
        label: t('navigation.systemSettings', 'System Settings'),
        requiredPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        subItems: [
          {
            path: '/dashboard/system-settings/tags',
            label: t('navigation.tags', 'Tags'),
            icon: 'file-01',
            requiredPermission: PERMISSIONS.TAGS.VIEW,
          },
          {
            path: '/dashboard/system-settings/scoring-configuration',
            label: t('navigation.scoringConfiguration'),
            icon: 'chart-01',
            requiredPermission: PERMISSIONS.SCORING_CONFIG.VIEW,
          },
          {
            path: '/dashboard/system-settings/sms-templates',
            label: t('navigation.smsTemplates'),
            icon: 'mail-send-01',
            requiredPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
          },
          {
            path: '/dashboard/system-settings/target-actions',
            label: t('navigation.taManagement', 'Target Actions'),
            icon: 'file-01',
            requiredPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
          },
          {
            path: '/dashboard/system-settings/interaction-log',
            label: t('navigation.interactionLog', 'Interaction Log'),
            icon: 'file-01',
            requiredPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
          },
        ],
      },
    ]

    const hasPermission = (
      perm?: Permission,
      perms?: Permission[],
      mode?: 'any' | 'all'
    ): boolean => {
      if (!perm && !perms) return true
      if (perm) return user?.permissions?.includes(perm) ?? false
      if (perms && perms.length > 0) {
        if (mode === 'any') {
          return perms.some((p: Permission) => user?.permissions?.includes(p)) ?? false
        }
        return perms.every((p: Permission) => user?.permissions?.includes(p)) ?? false
      }
      return true
    }

    const filteredItems = allNavItems
      .map((item) => {
        // Filter sub-items first based on permissions
        if (item.subItems) {
          const filteredSubItems = item.subItems.filter((subItem) =>
            hasPermission(subItem.requiredPermission, subItem.requiredPermissions, subItem.mode)
          )
          return { ...item, subItems: filteredSubItems }
        }
        return item
      })
      .filter((item) => {
        if (item.disabled) return true

        // If item has sub-items, show parent when at least one sub-item is visible
        if (item.subItems) {
          return item.subItems.length > 0
        }

        // Leaf items: check own permission
        return hasPermission(item.requiredPermission, item.requiredPermissions, item.mode)
      })

    // Separate System Settings to render at bottom
    const systemSettingsItem = filteredItems.find(
      (item) => item.path === '/dashboard/system-settings'
    )
    const regularItems = filteredItems.filter((item) => item.path !== '/dashboard/system-settings')
    const bottomItems = systemSettingsItem ? [systemSettingsItem] : []

    return { navItems: regularItems, bottomNavItems: bottomItems }
    // i18n.language is needed to recalculate navigation items when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.permissions, t, i18n.language])

  const { navItems, bottomNavItems } = navItemsResult
  const { toggleSidebar } = useSidebarStore()

  const isAiAssistantRoute =
    location.pathname === '/dashboard/ai-assistant' ||
    location.pathname === '/dashboard/ai-assistant/'

  return (
    <div
      className={cn(
        'bg-light-50 bg-dashboard-light min-h-screen bg-cover bg-center',
        /* Long scroll (chat): fixed attachment paints vs viewport so the SVG does not “run out” mid-page */
        isAiAssistantRoute ? '[background-attachment:fixed]' : 'bg-no-repeat'
      )}
    >
      {/* Sidebar */}
      <Sidebar items={navItems} bottomItems={bottomNavItems} />

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
                value={localSearchQuery}
                searchTypeValue={localSearchType}
              />
              {showSearchDropdown && (
                <SearchResults
                  query={localSearchQuery}
                  searchType={localSearchType}
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
            <NotificationBell />
            <AiAssistantHeaderButton />
            <UserProfile onLogoutClick={handleLogoutClick} />
          </div>

          {/* Mobile: Notification bell + dropdown menu */}
          <div className="flex items-center gap-2 lg:hidden">
            <NotificationBell />
            <AiAssistantHeaderButton />
            <MobileHeaderMenu onLogoutClick={handleLogoutClick} />
          </div>
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

      {/* Incoming Call Modal */}
      {incomingCall && (
        <CallDialogModal
          open={true}
          onClose={dismissIncomingCall}
          initialState="incoming"
          clientName={incomingCall.client_name || 'Unknown Caller'}
          phoneNumber={incomingCall.customer_phone}
          callId={incomingCall.call_id}
          loans={incomingCall.loans?.map((loan) => ({
            id: loan.loan_id.toString(),
            clientName: incomingCall.client_name || 'Unknown',
            loanNumber: loan.contract_number,
            counterparty: '', // Not provided by backend
            loanPrincipal: Number(loan.remaining_debt) || 0,
            debt: Number(loan.remaining_debt) || 0,
            status: loan.status,
            saleDate: '', // Not provided by backend
            lastContact: '', // Not provided by backend
            priority: 'Medium' as const, // Default priority
            score: 0, // Not provided by backend
          }))}
          onAnswer={() => {
            // TODO: Handle answer call - send to backend
            dismissIncomingCall()
          }}
          onReject={() => {
            // TODO: Handle reject call - send to backend
            dismissIncomingCall()
          }}
        />
      )}
    </div>
  )
}

export default DashboardLayout
