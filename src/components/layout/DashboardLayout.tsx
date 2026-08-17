import { type ReactNode, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/features/auth'
import { useV3UiEnabled } from '@/features/scoring/hooks/useV3Scores'
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
import { MinimizedChainExecutorBubble } from './MinimizedChainExecutorBubble'
import { NotificationBell } from './NotificationBell'
import { ThemeModeToggle } from './ThemeModeToggle'
import { PERMISSIONS } from '@/constants/permissions'
import type { Permission } from '@/constants/permissions'
import { useHasPermission } from '@/hooks/usePermissions'
import { SearchResults, type SearchResult } from '@/components/ui/SearchResults'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatClientFullName } from '@/lib/formatters'
import { Icons } from '@/lib/icons'
import { useCallStore } from '@/stores/callStore'
import { CallDialogModal } from '@/pages/ClientManagement/components/CallDialogModal'
import { CallRecordingModal } from '@/pages/ClientManagement/components/CallRecordingModal'
import { useIncomingCall } from '@/features/calls/hooks/useIncomingCall'
import { useCanShowIncomingPopup } from '@/features/calls/hooks/useCanShowIncomingPopup'
import { IncomingCallWindowContainer } from '@/features/calls/components/IncomingCallWindowContainer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { searchClients, mapPriorityLevel, type SearchType } from '@/api/clientSearchApi'
import { RouteChangeTracker, TrackingProvider } from '@/features/operatorAnalytics'
import { LawyerWorkplaceHeaderNav } from '@/pages/LawyerWorkplace/components/LawyerWorkplaceHeaderNav'
import { useLegalInboxSummary } from '@/features/lawyerWorkplace'
import { useAiAssistantSettings } from '@/features/aiSettings/hooks/useAiAssistantSettings'

// Minimum digit count required to fire a phone-type search. Mirrors the
// backend guard at services/client/app/routers/search.py (PHONE_MIN_DIGITS).
// Inputs shorter than this would return tens of thousands of substring
// matches and choke the enrichment pipeline; gating on the client avoids
// the round trip and lets the dropdown show a clear "keep typing" hint.
const PHONE_SEARCH_MIN_DIGITS = 8

interface DashboardLayoutProps {
  children: ReactNode
}

// Exported (in addition to being used inline below) so it can be unit-tested
// without mounting the rest of DashboardLayout's auth/websocket/search stack.
export function AiAssistantHeaderButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('common')
  const canUseAssistant = useHasPermission(PERMISSIONS.AI_ASSISTANT.USE)
  const { data: aiSettings } = useAiAssistantSettings()
  const isActive = location.pathname === '/dashboard/ai-assistant'

  // Entitlement + kill-switch: hide for users without use_ai_assistant and
  // for everyone while the global switch is off. Fail-open: while settings
  // are loading/unavailable the button stays (backend still enforces).
  if (!canUseAssistant || aiSettings?.assistant_enabled === false) {
    return null
  }

  return (
    <button
      type="button"
      aria-label={t('pages.aiAssistant.headerButtonAria')}
      onClick={() => navigate('/dashboard/ai-assistant')}
      className={cn(
        'hover:bg-muted relative flex h-9 w-9 items-center justify-center rounded-full transition-colors focus:outline-none',
        isActive && 'bg-muted'
      )}
    >
      <Icons.AiBrain03
        size={20}
        strokeWidth={1.5}
        className={cn('transition-colors', isActive ? 'text-primary-600' : 'text-muted-foreground')}
      />
    </button>
  )
}

// Extend SidebarItem interface to support permission checking
interface ExtendedSidebarItem extends SidebarItem {
  requiredPermission?: Permission
  requiredPermissions?: Permission[]
  mode?: 'any' | 'all'
  subItems?: ExtendedSidebarSubItem[]
}

type ExtendedSidebarSubItem = SidebarSubItem & {
  requiredPermission?: Permission
  requiredPermissions?: Permission[]
  mode?: 'any' | 'all'
  children?: ExtendedSidebarSubItem[]
}

function filterSidebarSubItems(
  subItems: ExtendedSidebarSubItem[],
  hasPermission: (perm?: Permission, perms?: Permission[], mode?: 'any' | 'all') => boolean
): ExtendedSidebarSubItem[] {
  return subItems.flatMap((subItem) => {
    if (subItem.children && subItem.children.length > 0) {
      const filteredChildren = (subItem.children as ExtendedSidebarSubItem[]).filter((child) =>
        hasPermission(child.requiredPermission, child.requiredPermissions, child.mode)
      )
      if (filteredChildren.length === 0) return []
      return [{ ...subItem, children: filteredChildren }]
    }

    return hasPermission(subItem.requiredPermission, subItem.requiredPermissions, subItem.mode)
      ? [subItem]
      : []
  })
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

  // Determine if call is active for styling. 'incoming' counts: the call is
  // still ringing, so its timer must keep running while minimized.
  const isActiveCall =
    minimizedCall?.type === 'call-dialog' &&
    (minimizedCall.callState === 'dialing' ||
      minimizedCall.callState === 'connected' ||
      minimizedCall.callState === 'incoming')

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
              <div className="text-foreground truncate text-sm font-semibold">
                {minimizedCall.clientName}
              </div>
              <div className="text-muted-foreground text-xs">
                {minimizedCall.displayPhone || minimizedCall.phoneNumber}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
            <span className="text-foreground text-xs font-medium">{getStatusText()}</span>
          </div>

          {/* Call details — hidden in 'initial' state since nothing has been committed yet */}
          {minimizedCall.callState !== 'initial' && (
            <div className="border-border flex flex-col gap-2 border-t pt-2">
              {minimizedCall.callType && (
                <div className="flex items-center gap-2">
                  <Icons.Phone size={14} className="text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-muted-foreground text-xs capitalize">
                    {minimizedCall.callType.replace('-', ' ')}
                  </span>
                </div>
              )}
              {minimizedCall.elapsedTime !== undefined && minimizedCall.elapsedTime > 0 && (
                <div className="flex items-center gap-2">
                  <Icons.StopWatch size={14} className="text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-muted-foreground text-xs">
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
              <div className="text-foreground truncate text-sm font-semibold">
                {minimizedCall.callData?.clientName || minimizedCall.clientName}
              </div>
              <div className="text-muted-foreground text-xs">
                {minimizedCall.callData?.phone || minimizedCall.phoneNumber}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className="bg-primary-500 h-2 w-2 rounded-full" />
            <span className="text-foreground text-xs font-medium">
              {t('pages.clients.modals.callRecording.title')}
            </span>
          </div>

          {/* Call details */}
          <div className="border-border flex flex-col gap-2 border-t pt-2">
            {minimizedCall.callData?.type && (
              <div className="flex items-center gap-2">
                <Icons.Info size={14} className="text-muted-foreground" strokeWidth={1.5} />
                <span className="text-muted-foreground text-xs">{minimizedCall.callData.type}</span>
              </div>
            )}
            {minimizedCall.callData?.operator && (
              <div className="flex items-center gap-2">
                <Icons.User size={14} className="text-muted-foreground" strokeWidth={1.5} />
                <span className="text-muted-foreground text-xs">
                  {t('pages.clients.modals.callRecording.operator')}:{' '}
                  {minimizedCall.callData.operator}
                </span>
              </div>
            )}
            {minimizedCall.callData?.duration && (
              <div className="flex items-center gap-2">
                <Icons.StopWatch size={14} className="text-muted-foreground" strokeWidth={1.5} />
                <span className="text-muted-foreground text-xs">
                  {t('pages.clients.modals.callRecording.duration')}:{' '}
                  {minimizedCall.callData.duration}
                </span>
              </div>
            )}
            {minimizedCall.callData?.date && minimizedCall.callData?.time && (
              <div className="flex items-center gap-2">
                <Icons.Calendar size={14} className="text-muted-foreground" strokeWidth={1.5} />
                <span className="text-muted-foreground text-xs">
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
    <>
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
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem disabled className="text-foreground text-sm">
            <Icons.User02 size={16} className="mr-2" />
            <span className="truncate">{displayName}</span>
          </DropdownMenuItem>

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
                    className="border-border bg-card max-w-sm border p-4 shadow-xl"
                  >
                    {getTooltipContent()}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}

          <DropdownMenuItem
            onClick={() => {
              setIsOpen(false)
              navigate('/dashboard/profile')
            }}
            className="text-foreground text-sm"
          >
            <Icons.SlidersHorizontal size={16} className="mr-2" />
            <span>{t('navigation.profile')}</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onLogoutClick} className="text-foreground text-sm">
            <Icons.Logout size={16} className="mr-2" />
            <span>{t('actions.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Restore call modals outside the dropdown root so Radix portals do not nest incorrectly */}
      {isRestored && minimizedCall?.type === 'call-dialog' && (
        <CallDialogModal
          open={isRestored}
          onClose={handleCloseCall}
          onMinimize={handleMinimizeCall}
          clientName={minimizedCall.clientName}
          phoneNumber={minimizedCall.phoneNumber}
          callId={minimizedCall.callId}
          loans={minimizedCall.loans}
          incomingContext={minimizedCall.incomingContext}
          incomingClients={minimizedCall.incomingClients}
          initialState={minimizedCall.callState || 'initial'}
          initialElapsedTime={minimizedCall.elapsedTime ?? 0}
          minimizedAt={isActiveCall ? minimizedCall.timestamp : undefined}
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
    </>
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
  const [searchHint, setSearchHint] = useState<string | null>(null)
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

  // The call-service is the only authority on a call being over. Without this,
  // a window whose call ended is cleared solely by the bubble's own polling —
  // which needs the bubble mounted and the lookup to succeed, and leaves the
  // window suppressing the incoming popup whenever either fails.
  const handleCallSettled = useCallback((callId: string) => {
    useCallStore.getState().closeWindowForCall(callId)
  }, [])

  // Handle incoming calls
  const { incomingCall, answeredAt, markAnswered, dismissIncomingCall } = useIncomingCall(
    agentExtension,
    {
      onCallSettled: handleCallSettled,
    }
  )

  // One call window at a time. False until the answer is known — see the hook
  // for why the popup may not render before then.
  const canShowIncomingPopup = useCanShowIncomingPopup(incomingCall?.call_id)

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
        setSearchHint(null)
        setShowSearchDropdown(false)
        return
      }

      // Phone search needs enough digits to be both useful (results small
      // enough to render) and fast (enrichment doesn't choke on tens of
      // thousands of candidate contacts). The backend enforces the same
      // threshold — see PHONE_MIN_DIGITS in services/client/.../search.py.
      // Doing the gate client-side avoids a round trip entirely and lets
      // us show the user a clear "keep typing" hint.
      if (type === 'phone') {
        const phoneDigitCount = (query.match(/\d/g) ?? []).length
        if (phoneDigitCount < PHONE_SEARCH_MIN_DIGITS) {
          setLocalSearchQuery(query)
          setLocalSearchType(type)
          setSearchResults([])
          setIsSearching(false)
          setSearchError(null)
          setSearchHint(t('search.phoneMinDigits', { count: PHONE_SEARCH_MIN_DIGITS }))
          setShowSearchDropdown(true)
          return
        }
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
      setSearchHint(null)
      setShowSearchDropdown(true)

      try {
        // Map frontend search type to backend SearchType
        let backendSearchType: SearchType = 'all'
        if (type === 'phone') {
          backendSearchType = 'phone'
        } else if (type === 'name') {
          backendSearchType = 'name'
        } else if (type === 'tin') {
          backendSearchType = 'tin'
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
          name: formatClientFullName(item),
          debt: item.total_debt,
          phone: (item.phones ?? []).join(', '),
          email: item.email_primary ?? '',
          priority: mapPriorityLevel(item.priority_level),
          score: item.priority_score,
          contactSource: item.contact_source ?? null,
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

  const canViewLegalWorkplace = useMemo(
    () =>
      Boolean(
        user?.permissions?.includes(PERMISSIONS.LEGAL_WORKPLACE.VIEW) ||
        user?.permissions?.includes(PERMISSIONS.SYSTEM.MANAGE_SETTINGS)
      ),
    [user?.permissions]
  )

  const { unprocessedCount: legalUnprocessedCount } = useLegalInboxSummary({
    enabled: canViewLegalWorkplace,
  })

  // v3 work list is per brand: only brands cut over after the KAN-794 sign-off
  // get the nav entry.
  const v3UiEnabled = useV3UiEnabled()

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
            path: '/dashboard/import/clients',
            label: t('navigation.importClients'),
            icon: 'file-import',
            requiredPermission: PERMISSIONS.DATA.IMPORT,
          },
          {
            path: '/dashboard/import/bulk-operator-assignment',
            label: t('navigation.bulkOperatorAssignment', 'Bulk Operator Assignment'),
            icon: 'user-multiple-02',
            requiredPermission: PERMISSIONS.CLIENTS.EDIT,
          },
          {
            path: '/dashboard/import/bulk-tag-assignment',
            label: t('navigation.bulkTagAssignment', 'Bulk Tag Assignment'),
            icon: 'tag-01',
            requiredPermission: PERMISSIONS.CLIENTS.ASSIGN_TAGS,
          },
          {
            path: '/dashboard/import/bulk-payment-import',
            label: t('navigation.bulkPaymentVerification'),
            icon: 'transaction-history',
            requiredPermission: PERMISSIONS.DATA.IMPORT_PAYMENTS,
          },
          {
            path: '/dashboard/import/bulk-writeoff-import',
            label: t('navigation.bulkWriteoffImport', 'Bulk Write-off Import'),
            icon: 'file-import',
            requiredPermission: PERMISSIONS.WRITEOFFS.BULK,
          },
          {
            path: '/dashboard/import/bulk-reversal-import',
            label: t('navigation.bulkReversalImport', 'Bulk Reversal Import'),
            icon: 'transaction-history',
            requiredPermission: PERMISSIONS.REVERSALS.BULK,
          },
          {
            path: '/dashboard/import/bulk-sale-notes-import',
            label: t('navigation.bulkSaleNotesImport', 'Bulk Sales Note Import'),
            icon: 'activity-01',
            requiredPermission: PERMISSIONS.SALE_NOTES.MANAGE,
          },
          {
            path: '/dashboard/import/bulk-document-import',
            label: t('navigation.bulkDocumentImport', 'Bulk Document Import'),
            icon: 'file-01',
            requiredPermission: PERMISSIONS.DATA.IMPORT_DOCUMENTS,
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
        path: '/dashboard/dialer',
        icon: 'call-dialer',
        label: t('navigation.dialer', 'Dialer'),
        requiredPermission: PERMISSIONS.DIALER.VIEW,
      },
      {
        path: '/dashboard/messaging/campaigns',
        icon: 'mail-send-01',
        label: t('navigation.campaignAnalytics', 'Campaign Analytics'),
        requiredPermission: PERMISSIONS.MESSAGING.VIEW_CAMPAIGN_ANALYTICS,
      },
      {
        path: '/dashboard/training',
        icon: 'analytics-01',
        label: t('navigation.training', 'Training'),
        requiredPermission: PERMISSIONS.TRAINING.VIEW,
      },
      {
        path: '/dashboard/lawyer-workplace',
        icon: 'work',
        label: t('navigation.lawyerWorkplace', 'Lawyer Workplace'),
        requiredPermissions: [PERMISSIONS.LEGAL_WORKPLACE.VIEW, PERMISSIONS.SYSTEM.MANAGE_SETTINGS],
        mode: 'any' as const,
        badge: legalUnprocessedCount > 0 ? legalUnprocessedCount : undefined,
      },
      {
        path: '/dashboard/action-analysis',
        icon: 'analytics-01',
        label: t('navigation.actionAnalysis'),
        requiredPermission: PERMISSIONS.ACTION_ANALYSIS.VIEW,
      },
      {
        path: '/dashboard/team-management',
        icon: 'user-multiple-02',
        label: t('navigation.teamManagement', 'Team Management'),
        subItems: [
          {
            path: '/dashboard/team-management/users',
            label: t('navigation.users'),
            icon: 'user-search-01',
            requiredPermission: PERMISSIONS.USERS.VIEW,
          },
          {
            path: '/dashboard/team-management/roles',
            label: t('navigation.roles'),
            icon: 'user-circle-02',
            requiredPermission: PERMISSIONS.SYSTEM.MANAGE_ROLES,
          },
          {
            path: '/dashboard/team-management/departments',
            label: t('navigation.departments'),
            icon: 'briefcase-01',
            requiredPermission: PERMISSIONS.SYSTEM.MANAGE_ROLES,
          },
        ],
      },
      {
        path: '/dashboard/sellers',
        icon: 'user-multiple',
        label: t('navigation.sellers'),
        requiredPermission: PERMISSIONS.SELLERS.VIEW,
      },
      {
        path: '/dashboard/audit-logs',
        icon: 'transaction-history',
        label: t('navigation.auditLogs'),
        requiredPermission: PERMISSIONS.SYSTEM.VIEW_AUDIT_LOGS,
      },
      {
        path: '/dashboard/messaging-settings',
        icon: 'message-multiple-01',
        label: t('navigation.messagingSettings', 'Messaging Settings'),
        requiredPermissions: [
          PERMISSIONS.MESSAGING.MANAGE_INTEGRATIONS,
          PERMISSIONS.MESSAGING.MANAGE_DRAFTS,
        ],
        mode: 'any' as const,
        subItems: [
          {
            path: '/dashboard/system-settings/messaging-integrations',
            label: t('navigation.messagingIntegrations', 'Messaging Integrations'),
            icon: 'message-secure-01',
            requiredPermission: PERMISSIONS.MESSAGING.MANAGE_INTEGRATIONS,
          },
          {
            path: '/dashboard/system-settings/messaging-drafts',
            label: t('navigation.messagingDrafts', 'Message Drafts'),
            icon: 'bubble-chat-edit',
            requiredPermission: PERMISSIONS.MESSAGING.MANAGE_DRAFTS,
          },
        ],
      },
      {
        path: '/dashboard/system-settings',
        icon: 'setting-07',
        label: t('navigation.systemSettings', 'System Settings'),
        requiredPermissions: [
          PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
          PERMISSIONS.CONTACT_TYPES.VIEW,
          PERMISSIONS.REPAYMENT_CONFIG.VIEW,
          PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS,
          PERMISSIONS.SYSTEM.MANAGE_CALL_QA,
        ],
        mode: 'any' as const,
        subItems: [
          {
            path: '/dashboard/system-settings/ai',
            label: t('navigation.aiSettings', 'AI Settings'),
            icon: 'ai-brain-03',
            requiredPermissions: [
              PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS,
              PERMISSIONS.SYSTEM.MANAGE_CALL_QA,
              PERMISSIONS.SYSTEM.MANAGE_ROLES,
            ],
            mode: 'any' as const,
          },
          {
            // TODO(ubki): swap to a dedicated manage_integrations permission
            // once it exists (reusing messaging integrations for now).
            path: '/dashboard/system-settings/integrations/ubki',
            label: t('navigation.ubkiIntegration', 'UBKI Integration'),
            icon: 'briefcase-01',
            requiredPermission: PERMISSIONS.MESSAGING.MANAGE_INTEGRATIONS,
          },
          {
            path: '/dashboard/system-settings/tags',
            label: t('navigation.tags', 'Tags'),
            icon: 'file-01',
            requiredPermission: PERMISSIONS.TAGS.VIEW,
          },
          {
            path: '/dashboard/system-settings/contact-types',
            label: t('navigation.contactTypes', 'Contact Types'),
            icon: 'user-multiple-02',
            requiredPermission: PERMISSIONS.CONTACT_TYPES.VIEW,
          },
          {
            path: '/dashboard/system-settings/contact-tags',
            label: t('navigation.contactTags', 'Contact Tags'),
            icon: 'tag-01',
            requiredPermission: PERMISSIONS.CONTACT_TAGS.MANAGE,
          },
          {
            path: '/dashboard/system-settings/scoring-configuration',
            label: t('navigation.scoringConfiguration'),
            icon: 'chart-01',
            requiredPermission: PERMISSIONS.SCORING_CONFIG.VIEW,
          },
          {
            // Shadow-run report (KAN-794) — always visible to anyone who can see
            // scoring config. It is how the brand is reviewed BEFORE cutover, so
            // it must NOT be behind the cutover switch.
            path: '/dashboard/system-settings/scoring-v3-monitoring',
            label: t('navigation.scoringV3Monitoring', 'v3 Shadow-Run Report'),
            icon: 'chart-01',
            requiredPermission: PERMISSIONS.SCORING_CONFIG.VIEW,
          },
          {
            // v3 tunables (KAN-792). Sits next to the shadow-run report because
            // that is where tau actually gets decided.
            path: '/dashboard/system-settings/scoring-v3-settings',
            label: t('navigation.scoringV3Settings', 'v3 Scoring Settings'),
            icon: 'chart-01',
            requiredPermission: PERMISSIONS.SCORING_CONFIG.VIEW,
          },
          // Scoring v3 operator work list (KAN-791). Hidden until THIS brand has
          // passed the shadow-run sign-off (KAN-794) — flipped per brand from the
          // scoring config, no rebuild.
          ...(v3UiEnabled
            ? [
                {
                  path: '/dashboard/operator-work-list',
                  label: t('navigation.operatorWorkList', 'Priority Work List'),
                  icon: 'chart-01',
                  // operators' own queue — see routes/index.tsx
                  requiredPermission: PERMISSIONS.SCORING_CONFIG.VIEW_PRIORITY_SCORES,
                },
              ]
            : []),
          {
            path: '/dashboard/system-settings/repayment-configuration',
            label: t('navigation.repaymentConfiguration'),
            icon: 'chart-01',
            requiredPermission: PERMISSIONS.REPAYMENT_CONFIG.VIEW,
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
          {
            path: '/dashboard/system-settings/document-generation',
            label: t('navigation.documentGeneration', 'Document Generation'),
            icon: 'file-01',
            requiredPermissions: [
              PERMISSIONS.DOCUMENT_GENERATION.VIEW_JOURNAL,
              PERMISSIONS.DOCUMENT_GENERATION.VIEW_TEMPLATES,
              PERMISSIONS.DOCUMENT_GENERATION.CREATE_EDIT_TEMPLATES,
              PERMISSIONS.DOCUMENT_GENERATION.DELETE_TEMPLATES,
            ],
            mode: 'any' as const,
          },
          {
            path: '/dashboard/system-settings/ip-whitelist',
            label: t('navigation.ipWhitelist', 'IP Whitelist'),
            icon: 'sliders-horizontal',
            requiredPermission: PERMISSIONS.USERS.EDIT,
          },
          {
            path: '/dashboard/system-settings/rr-notifications',
            label: t('navigation.rrNotifications', 'RR Notifications'),
            icon: 'mail',
            requiredPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
          },
          {
            path: '/dashboard/system-settings/rr-periodicity',
            label: t('navigation.rrPeriodicity', 'RR Payment Periodicity'),
            icon: 'calendar-01',
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
          const filteredSubItems = filterSidebarSubItems(item.subItems, hasPermission)
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

    // Pin settings menus at the bottom of the sidebar (Messaging above System Settings)
    const bottomNavPaths = ['/dashboard/messaging-settings', '/dashboard/system-settings'] as const
    const bottomItems = bottomNavPaths
      .map((path) => filteredItems.find((item) => item.path === path))
      .filter((item): item is ExtendedSidebarItem => item != null)
    const regularItems = filteredItems.filter(
      (item) => !bottomNavPaths.includes(item.path as (typeof bottomNavPaths)[number])
    )

    return { navItems: regularItems, bottomNavItems: bottomItems }
    // i18n.language is needed to recalculate navigation items when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.permissions, t, i18n.language, legalUnprocessedCount, v3UiEnabled])

  const { navItems, bottomNavItems } = navItemsResult
  const { toggleSidebar } = useSidebarStore()

  const isAiAssistantRoute =
    location.pathname === '/dashboard/ai-assistant' ||
    location.pathname === '/dashboard/ai-assistant/'

  const isLawyerWorkplaceRoute =
    location.pathname === '/dashboard/lawyer-workplace' ||
    location.pathname.startsWith('/dashboard/lawyer-workplace/')

  return (
    <TrackingProvider>
      <RouteChangeTracker />
      <div
        className={cn(
          'bg-background bg-dashboard-light min-h-screen bg-cover bg-center',
          isAiAssistantRoute ? '[background-attachment:fixed]' : 'bg-no-repeat'
        )}
      >
        {/* Sidebar */}
        <Sidebar items={navItems} bottomItems={bottomNavItems} />

        {/* Main Content Area with left margin for sidebar - no margin below xl */}
        <div
          className={cn(
            'min-w-0 transition-all duration-300',
            'xl:ml-18', // Desktop: always has margin for collapsed sidebar
            isOpenSideBar && 'xl:ml-60' // Desktop: expanded sidebar
          )}
        >
          {/* Fixed Header */}
          <header
            className={cn(
              'bg-elevated border-border/40 fixed top-0 right-0 z-20 flex h-[60px] justify-between border-l px-3 shadow-sm transition-all duration-300 sm:px-4 lg:px-6',
              isLawyerWorkplaceRoute ? 'items-stretch' : 'items-center',
              'left-0 xl:left-18',
              isOpenSideBar && 'xl:left-60'
            )}
          >
            {/* Left side: Menu button (mobile) + Search Bar or Lawyer Workplace nav */}
            <div
              className={cn(
                'relative flex gap-2 lg:gap-3',
                isLawyerWorkplaceRoute
                  ? 'min-w-0 flex-1 items-stretch self-stretch overflow-hidden'
                  : 'items-center'
              )}
            >
              {/* Mobile menu button */}
              <button
                onClick={toggleSidebar}
                className={cn(
                  'focus:ring-primary-500 focus:ring-offset-background group border-border bg-card hover:bg-muted active:bg-muted flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md focus:ring-2 focus:ring-offset-2 focus:outline-none active:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 xl:hidden',
                  isLawyerWorkplaceRoute && 'self-center'
                )}
                aria-label="Toggle menu"
              >
                <Icons.Menu11
                  size={20}
                  className="text-foreground transition-transform duration-200 group-hover:scale-110"
                  strokeWidth={1.5}
                />
              </button>

              {isLawyerWorkplaceRoute ? (
                <LawyerWorkplaceHeaderNav />
              ) : (
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
                      hint={searchHint}
                      onViewAll={handleViewAllResults}
                      onResultClick={handleResultClick}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Right side: Desktop - individual buttons, Mobile - grouped dropdown */}
            {/* Desktop: Project Selector, Language Switcher and User Profile */}
            <div className="hidden shrink-0 items-center gap-3 self-center lg:flex">
              <MinimizedCallBubble />
              <MinimizedChainExecutorBubble />
              <NotificationBell />
              <ThemeModeToggle />
              <AiAssistantHeaderButton />
              <UserProfile onLogoutClick={handleLogoutClick} />
            </div>

            <div className="flex shrink-0 items-center gap-1.5 self-center sm:gap-2 lg:hidden">
              <MinimizedCallBubble />
              <MinimizedChainExecutorBubble />
              <NotificationBell />
              <ThemeModeToggle />
              <AiAssistantHeaderButton />
              <MobileHeaderMenu onLogoutClick={handleLogoutClick} />
            </div>
          </header>

          {/* Scrollable Page Content with top padding for fixed header */}
          <main
            className={cn(
              'min-h-screen overflow-y-auto px-4 pt-[80px] pb-4 sm:px-6 sm:pb-6 lg:px-[28px] lg:pb-[20px]',
              isLawyerWorkplaceRoute && 'overflow-x-hidden'
            )}
          >
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

        {/* Incoming Call Modal — suppressed while another call window is up */}
        {incomingCall && canShowIncomingPopup && (
          <IncomingCallWindowContainer
            // A queue can replace one ringing call with another without the
            // window ever unmounting; a per-call identity keeps the second
            // call from inheriting the first one's timer and form state.
            key={incomingCall.call_id}
            incomingCall={incomingCall}
            answeredAt={answeredAt}
            onAnswered={markAnswered}
            agentExtension={agentExtension}
            onDismiss={dismissIncomingCall}
          />
        )}
      </div>
    </TrackingProvider>
  )
}

export default DashboardLayout
