/**
 * User Management Page
 *
 * Main page component for managing system users.
 * Integrated with real API using React Query.
 */

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth'
import { useUsers } from '@/features/users/hooks/useUsers'
import { useURLState, useAutoPersistedState } from '@/hooks'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { CreateUserModal } from './components/CreateUserModal'
import { UserDetailModal } from './components/UserDetailModal'
import { EditUserModal } from './components/EditUserModal'
import ChangeStatusModal from './components/ChangeStatusModal'
import { ResetPasswordConfirmModal } from './components/ResetPasswordConfirmModal'
import { AdminToggleTwoFactorModal } from './components/AdminToggleTwoFactorModal'
import { UnlockAccountModal } from './components/UnlockAccountModal'
import { GoogleAuthenticatorStatusIcon } from './components/GoogleAuthenticatorStatusIcon'
import { UserSearchBar } from './components/UserSearchBar'
import { UserFiltersBar } from './components/UserFiltersBar'
import { FilterTemplatesMenu } from './components/FilterTemplatesMenu'
import type {
  ApiUser,
  FilterTemplate,
  UserSearchField,
  UserSortOrder,
} from '@/features/users/types'
import { ALL_PROJECTS, departmentsOf, positionsOf } from './lib/employeeOrg'
import {
  filterStateToTemplate,
  templateToExtras,
  templateToFilterState,
} from './lib/filterTemplateMapping'
import { Icons } from '@/lib/icons'
import { DataTable, type Column, type SortConfig } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { DoubleButton } from '@/components/ui/DoubleButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

import {
  ALL_FILTER_VALUE,
  DEFAULT_USER_FILTERS,
  DEFAULT_USER_SORT_BY,
  DEFAULT_USER_SORT_ORDER,
  DEFAULT_USER_STATUS_FILTER,
  DEFAULT_WORK_FORMAT_FILTER,
  statusFilterToApiStatus,
  workFormatToApiValue,
  type UserFilterState,
  type WorkFormatFilter,
} from './lib/userFilterDefaults'

function IconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className="text-foreground hover:bg-muted flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const DEFAULT_PAGE_SIZE = 10
const DEFAULT_SEARCH_FIELD: UserSearchField = 'full_name'

const isUserLocked = (u: ApiUser): boolean =>
  !!u.locked_until && new Date(u.locked_until) > new Date()

export function UserManagementPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { startImpersonation, user: currentUser, isLoading: authLoading } = useAuth()

  // URL state for pagination and search
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [pageSize, setPageSize] = useURLState<number>('pageSize', DEFAULT_PAGE_SIZE)
  const [searchQuery, setSearchQuery] = useURLState<string>('search', '')
  const [searchField, setSearchField] = useURLState<UserSearchField>(
    'searchField',
    DEFAULT_SEARCH_FIELD,
    { debounce: 0 }
  )

  // URL state for filters and sort
  const [roleFilter, setRoleFilter] = useURLState<number>('role', ALL_FILTER_VALUE, {
    debounce: 0,
  })
  const [projectFilter, setProjectFilter] = useURLState<number>('project', ALL_FILTER_VALUE, {
    debounce: 0,
  })
  const [departmentFilter, setDepartmentFilter] = useURLState<number>(
    'department',
    ALL_FILTER_VALUE,
    { debounce: 0 }
  )
  const [groupFilter, setGroupFilter] = useURLState<number>('group', ALL_FILTER_VALUE, {
    debounce: 0,
  })
  const [workFormatFilter, setWorkFormatFilter] = useURLState<WorkFormatFilter>(
    'work_format',
    DEFAULT_WORK_FORMAT_FILTER,
    { debounce: 0 }
  )
  const [statusFilter, setStatusFilter] = useURLState<UserFilterState['statusFilter']>(
    'status',
    DEFAULT_USER_STATUS_FILTER,
    { debounce: 0 }
  )
  const [sortBy, setSortBy] = useURLState<string>('sort_by', DEFAULT_USER_SORT_BY, {
    debounce: 0,
  })
  const [sortOrder, setSortOrder] = useURLState<UserSortOrder>(
    'sort_order',
    DEFAULT_USER_SORT_ORDER,
    { debounce: 0 }
  )

  // Add persistence for state
  const { clear: clearPersistedState } = useAutoPersistedState(
    'user-management-state',
    {
      currentPage,
      pageSize,
      searchQuery,
      searchField,
      roleFilter,
      projectFilter,
      departmentFilter,
      groupFilter,
      statusFilter,
      sortBy,
      sortOrder,
    },
    {
      currentPage: setCurrentPage,
      pageSize: setPageSize,
      searchQuery: setSearchQuery,
      searchField: setSearchField,
      roleFilter: setRoleFilter,
      projectFilter: setProjectFilter,
      departmentFilter: setDepartmentFilter,
      groupFilter: setGroupFilter,
      statusFilter: setStatusFilter,
      sortBy: setSortBy,
      sortOrder: setSortOrder,
    }
  )

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewUserId, setViewUserId] = useState<number | null>(null)
  const [editUserId, setEditUserId] = useState<number | null>(null)
  const [changeStatusUser, setChangeStatusUser] = useState<ApiUser | null>(null)
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('active')
  const [impersonatingUserId, setImpersonatingUserId] = useState<number | null>(null)
  const [openDropdownUserId, setOpenDropdownUserId] = useState<number | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<ApiUser | null>(null)
  const [toggleTwoFactorUser, setToggleTwoFactorUser] = useState<ApiUser | null>(null)
  const [unlockUser, setUnlockUser] = useState<ApiUser | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep-link: open a user's detail when arrived with ?user_id=<id> (e.g. from
  // an Audit Log Entity link). Closing the modal clears the param.
  useEffect(() => {
    const raw = searchParams.get('user_id')
    if (!raw) return
    const id = Number(raw)
    if (Number.isFinite(id) && id > 0) {
      setViewUserId(id)
    }
  }, [searchParams])

  // Close dropdown when screen size crosses breakpoint (in either direction)
  useEffect(() => {
    let wasMobile = window.innerWidth < 1024 // lg breakpoint

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024

      // Close dropdown if transitioning across breakpoint (mobile <-> desktop)
      if (wasMobile !== isMobile && openDropdownUserId !== null) {
        setOpenDropdownUserId(null)
      }

      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [openDropdownUserId])

  // Fetch users with pagination, search, filters, and sort
  const userListParams = useMemo(
    () => ({
      page: currentPage,
      page_size: pageSize,
      search: searchQuery.trim() || undefined,
      search_field: searchQuery.trim() ? searchField : undefined,
      status: statusFilterToApiStatus(statusFilter),
      role_id: roleFilter > 0 ? roleFilter : undefined,
      project_id: projectFilter > 0 ? projectFilter : undefined,
      department_id: departmentFilter > 0 ? departmentFilter : undefined,
      group_id: groupFilter > 0 ? groupFilter : undefined,
      work_format: workFormatToApiValue(workFormatFilter),
      sort_by: sortBy as UserFilterState['sortBy'],
      sort_order: sortOrder,
    }),
    [
      currentPage,
      pageSize,
      searchQuery,
      searchField,
      statusFilter,
      roleFilter,
      projectFilter,
      departmentFilter,
      groupFilter,
      workFormatFilter,
      sortBy,
      sortOrder,
    ]
  )

  const { data, isLoading, isError, error } = useUsers(userListParams)

  const users = data?.users || []
  const totalUsers = data?.pagination.total_count || 0
  const totalPages = data?.pagination.total_pages || 0

  const handleCloseView = () => {
    setViewUserId(null)
    if (searchParams.has('user_id')) {
      const next = new URLSearchParams(searchParams)
      next.delete('user_id')
      setSearchParams(next, { replace: true })
    }
  }

  const handleCloseEdit = () => {
    setEditUserId(null)
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
  }

  const handleEditSuccess = () => {
    setEditUserId(null)
  }

  const handleEdit = (user: ApiUser) => {
    setEditUserId(user.id)
  }

  const handleView = (user: ApiUser) => {
    setViewUserId(user.id)
  }

  const handleImpersonate = async (user: ApiUser) => {
    setImpersonatingUserId(user.id)
    try {
      await startImpersonation(user.id)
      toast.success(t('pages.users.messages.nowViewingAs', { username: user.username }))

      // Redirect to dashboard to avoid permission issues
      // (impersonated user may not have access to current page)
      navigate('/dashboard')
    } catch (error: unknown) {
      console.error('Failed to impersonate user:', error)
      const err = error as { message?: string }
      toast.error(err.message || t('pages.users.messages.failedToImpersonate'))
    } finally {
      setImpersonatingUserId(null)
    }
  }

  const handleStatusToggle = (user: ApiUser, checked: boolean) => {
    // Toggle between active/inactive status
    const targetStatus = checked ? 'active' : 'inactive'

    // Open confirmation modal
    setChangeStatusUser(user)
    setNewStatus(targetStatus)
  }

  // Map status for StatusBadge component
  const getStatusType = (
    status: ApiUser['status']
  ): 'active' | 'disabled' | 'inactive' | 'suspended' => {
    if (status === 'active') return 'active'
    if (status === 'suspended') return 'suspended'
    if (status === 'inactive') return 'disabled' // Map inactive to disabled for UI
    return 'disabled'
  }

  const handleSearch = useCallback(() => {
    setCurrentPage(1)
  }, [setCurrentPage])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchField(DEFAULT_SEARCH_FIELD)
    setCurrentPage(1)
  }, [setSearchQuery, setSearchField, setCurrentPage])

  const handleSearchFieldChange = useCallback(
    (field: UserSearchField) => {
      setSearchField(field)
      if (searchQuery.trim()) {
        setCurrentPage(1)
      }
    },
    [searchQuery, setSearchField, setCurrentPage]
  )

  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      setCurrentPage(1)
    },
    [setSearchQuery, setCurrentPage]
  )

  const filterState = useMemo<UserFilterState>(
    () => ({
      roleId: roleFilter,
      projectId: projectFilter,
      departmentId: departmentFilter,
      groupId: groupFilter,
      workFormat: workFormatFilter,
      statusFilter,
      sortBy: sortBy as UserFilterState['sortBy'],
      sortOrder,
    }),
    [
      roleFilter,
      projectFilter,
      departmentFilter,
      groupFilter,
      workFormatFilter,
      statusFilter,
      sortBy,
      sortOrder,
    ]
  )

  const currentTemplateDocument = useMemo(
    () =>
      filterStateToTemplate(filterState, {
        search: searchQuery,
        searchField,
        pageSize,
      }),
    [filterState, searchQuery, searchField, pageSize]
  )

  const handleApplyTemplate = useCallback(
    (template: FilterTemplate) => {
      const restored = templateToFilterState(template.filters)
      const extras = templateToExtras(template.filters, {
        search: '',
        searchField: DEFAULT_SEARCH_FIELD,
        pageSize: DEFAULT_PAGE_SIZE,
      })

      setRoleFilter(restored.roleId)
      setProjectFilter(restored.projectId)
      setDepartmentFilter(restored.departmentId)
      setGroupFilter(restored.groupId)
      setWorkFormatFilter(restored.workFormat)
      setStatusFilter(restored.statusFilter)
      setSortBy(restored.sortBy)
      setSortOrder(restored.sortOrder)
      setSearchQuery(extras.search)
      setSearchField(extras.searchField)
      setPageSize(extras.pageSize)
      setCurrentPage(1)
    },
    [
      setRoleFilter,
      setProjectFilter,
      setDepartmentFilter,
      setGroupFilter,
      setWorkFormatFilter,
      setStatusFilter,
      setSortBy,
      setSortOrder,
      setSearchQuery,
      setSearchField,
      setPageSize,
      setCurrentPage,
    ]
  )

  const sortConfig = useMemo<SortConfig>(
    () => ({
      key: sortBy,
      order: sortOrder,
    }),
    [sortBy, sortOrder]
  )

  const handleFilterChange = useCallback(
    (next: Partial<UserFilterState>) => {
      if (next.roleId !== undefined) setRoleFilter(next.roleId)
      if (next.projectId !== undefined) setProjectFilter(next.projectId)
      if (next.departmentId !== undefined) setDepartmentFilter(next.departmentId)
      if (next.groupId !== undefined) setGroupFilter(next.groupId)
      if (next.workFormat !== undefined) setWorkFormatFilter(next.workFormat)
      if (next.statusFilter !== undefined) setStatusFilter(next.statusFilter)
      if (next.sortBy !== undefined) setSortBy(next.sortBy)
      if (next.sortOrder !== undefined) setSortOrder(next.sortOrder)
      setCurrentPage(1)
    },
    [
      setRoleFilter,
      setProjectFilter,
      setDepartmentFilter,
      setGroupFilter,
      setWorkFormatFilter,
      setStatusFilter,
      setSortBy,
      setSortOrder,
      setCurrentPage,
    ]
  )

  const handleResetFilters = useCallback(() => {
    setRoleFilter(DEFAULT_USER_FILTERS.roleId)
    setProjectFilter(DEFAULT_USER_FILTERS.projectId)
    setDepartmentFilter(DEFAULT_USER_FILTERS.departmentId)
    setGroupFilter(DEFAULT_USER_FILTERS.groupId)
    setWorkFormatFilter(DEFAULT_USER_FILTERS.workFormat)
    setStatusFilter(DEFAULT_USER_FILTERS.statusFilter)
    setSortBy(DEFAULT_USER_FILTERS.sortBy)
    setSortOrder(DEFAULT_USER_FILTERS.sortOrder)
    setCurrentPage(1)
    clearPersistedState()
  }, [
    setRoleFilter,
    setProjectFilter,
    setDepartmentFilter,
    setGroupFilter,
    setStatusFilter,
    setSortBy,
    setWorkFormatFilter,
    setSortOrder,
    setCurrentPage,
    clearPersistedState,
  ])

  const handleSort = useCallback(
    (key: string, order: UserSortOrder) => {
      setSortBy(key)
      setSortOrder(order)
      setCurrentPage(1)
    },
    [setSortBy, setSortOrder, setCurrentPage]
  )

  // Check if user is active (for toggle state)
  const isActive = (user: ApiUser) => {
    return user.status === 'active'
  }

  // Table columns definition
  const columns: Column<ApiUser>[] = [
    {
      key: 'id',
      header: t('pages.users.tableHeaders.userId'),
      sortable: true,
      sortKey: 'id',
      render: (user) => <span className="text-foreground">{user.id}</span>,
    },
    {
      key: 'fullName',
      header: t('pages.users.tableHeaders.fullName'),
      sortable: true,
      sortKey: 'full_name',
      render: (user) => (
        <button
          type="button"
          onClick={() => handleView(user)}
          className="text-foreground hover:text-primary cursor-pointer text-left font-medium underline-offset-2 hover:underline"
        >
          {user.full_name || user.username}
        </button>
      ),
    },
    {
      key: 'email',
      header: t('pages.users.tableHeaders.email'),
      sortable: true,
      sortKey: 'email',
      render: (user) => <span className="text-foreground">{user.email || '-'}</span>,
    },
    {
      key: 'position',
      header: t('pages.users.tableHeaders.position'),
      render: (user) => {
        const positions = positionsOf(user, projectFilter > 0 ? projectFilter : ALL_PROJECTS)
        if (positions.length === 0) {
          return <span className="text-muted-foreground">{t('pages.users.noRole')}</span>
        }
        return <span className="text-foreground">{positions.join(', ')}</span>
      },
    },
    {
      key: 'department',
      header: t('pages.users.tableHeaders.department'),
      render: (user) => {
        const departments = departmentsOf(user, projectFilter > 0 ? projectFilter : ALL_PROJECTS)
        if (departments.length === 0) {
          return <span className="text-muted-foreground">—</span>
        }
        return <span className="text-foreground">{departments.join(', ')}</span>
      },
    },
    {
      key: 'workFormat',
      header: t('pages.users.tableHeaders.workFormat'),
      align: 'center',
      render: (user) => (
        <span className="text-foreground">
          {user.work_format === 'remote'
            ? t('pages.profileSettings.workFormat.remote')
            : t('pages.profileSettings.workFormat.office')}
        </span>
      ),
    },
    {
      key: 'extension',
      header: t('pages.users.tableHeaders.extension'),
      align: 'center',
      render: (user) => (
        <div className="flex flex-col items-center gap-1">
          <span className="text-foreground text-sm">{user.asterisk_extension || '—'}</span>
          {user.is_agent && (
            <div className="flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  user.agent_status === 'online'
                    ? 'bg-success-500'
                    : user.agent_status === 'busy'
                      ? 'bg-warning-500'
                      : user.agent_status === 'on-call'
                        ? 'bg-error-500'
                        : 'bg-muted-foreground'
                }`}
              />
              <span className="text-muted-foreground text-xs capitalize">
                {user.agent_status || 'offline'}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: t('pages.users.tableHeaders.status'),
      align: 'center',
      sortable: true,
      sortKey: 'status',
      render: (user) => (
        <div className="flex items-center justify-center gap-1.5">
          <StatusBadge status={getStatusType(user.status)} />
          <GoogleAuthenticatorStatusIcon enabled={user.two_factor_enabled} />
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('pages.users.tableHeaders.actions'),
      align: 'center',
      render: (user) => (
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {/* Desktop: Individual link buttons */}
          <div className="hidden items-center gap-1 lg:flex">
            <IconAction
              label={t('pages.users.actions.view')}
              icon={<Icons.View size={18} strokeWidth={1.5} />}
              onClick={() => handleView(user)}
            />
            <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
              <IconAction
                label={t('pages.users.actions.edit')}
                icon={<Icons.PencilEdit size={18} strokeWidth={1.5} />}
                onClick={() => handleEdit(user)}
              />
            </PermissionGuard>

            <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
              {currentUser?.id !== String(user.id) && (
                <IconAction
                  label={t('pages.users.actions.resetPassword')}
                  icon={<Icons.LockSync01 size={18} strokeWidth={1.5} />}
                  onClick={() => setResetPasswordUser(user)}
                />
              )}
            </PermissionGuard>

            <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
              {currentUser?.id !== String(user.id) &&
                (user.two_factor_enabled || user.two_factor_has_secret) && (
                  <IconAction
                    label={
                      user.two_factor_enabled
                        ? t('pages.users.actions.disableTwoFactor')
                        : t('pages.users.actions.reenableTwoFactor')
                    }
                    icon={<Icons.Shield size={18} strokeWidth={1.5} />}
                    onClick={() => setToggleTwoFactorUser(user)}
                  />
                )}
            </PermissionGuard>

            <PermissionGuard permission={PERMISSIONS.USERS.IMPERSONATE}>
              {currentUser?.id !== String(user.id) && (
                <IconAction
                  label={
                    impersonatingUserId === user.id
                      ? t('pages.users.actions.impersonating')
                      : t('pages.users.actions.impersonate')
                  }
                  icon={<Icons.SecurityValidation size={18} strokeWidth={1.5} />}
                  onClick={() => handleImpersonate(user)}
                  disabled={authLoading || impersonatingUserId !== null}
                />
              )}
            </PermissionGuard>

            <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
              <IconAction
                label={t('pages.users.actions.unlock')}
                icon={<Icons.Unlock size={18} strokeWidth={1.5} />}
                onClick={() => setUnlockUser(user)}
                disabled={!isUserLocked(user)}
              />
            </PermissionGuard>
          </div>

          {/* Mobile/Tablet: Dropdown button group */}
          <div className="lg:hidden">
            <DropdownMenu
              modal={false}
              open={openDropdownUserId === user.id}
              onOpenChange={(open) => setOpenDropdownUserId(open ? user.id : null)}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-foreground border-border bg-card hover:bg-muted flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors focus:outline-none"
                  aria-label={t('pages.users.tableHeaders.actions')}
                >
                  <Icons.FilterVertical size={16} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card">
                <DropdownMenuItem
                  onClick={() => handleView(user)}
                  className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Icons.View size={16} strokeWidth={1.5} />
                  <span>{t('pages.users.actions.view')}</span>
                </DropdownMenuItem>
                <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
                  <DropdownMenuItem
                    onClick={() => handleEdit(user)}
                    className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Icons.PencilEdit size={16} strokeWidth={1.5} />
                    <span>{t('pages.users.actions.edit')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
                  {currentUser?.id !== String(user.id) && (
                    <DropdownMenuItem
                      onClick={() => {
                        setOpenDropdownUserId(null)
                        setResetPasswordUser(user)
                      }}
                      className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Icons.LockSync01 size={16} strokeWidth={1.5} />
                      <span>{t('pages.users.actions.resetPassword')}</span>
                    </DropdownMenuItem>
                  )}
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
                  {currentUser?.id !== String(user.id) &&
                    (user.two_factor_enabled || user.two_factor_has_secret) && (
                      <DropdownMenuItem
                        onClick={() => {
                          setOpenDropdownUserId(null)
                          setToggleTwoFactorUser(user)
                        }}
                        className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Icons.Shield size={16} strokeWidth={1.5} />
                        <span>
                          {user.two_factor_enabled
                            ? t('pages.users.actions.disableTwoFactor')
                            : t('pages.users.actions.reenableTwoFactor')}
                        </span>
                      </DropdownMenuItem>
                    )}
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.USERS.IMPERSONATE}>
                  {currentUser?.id !== String(user.id) && (
                    <DropdownMenuItem
                      onClick={() => handleImpersonate(user)}
                      disabled={authLoading || impersonatingUserId !== null}
                      className="text-foreground flex cursor-pointer items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Icons.SecurityValidation size={16} strokeWidth={1.5} />
                      <span>
                        {impersonatingUserId === user.id
                          ? t('pages.users.actions.impersonating')
                          : t('pages.users.actions.impersonate')}
                      </span>
                    </DropdownMenuItem>
                  )}
                </PermissionGuard>
                <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
                  <DropdownMenuItem
                    onClick={() => {
                      setOpenDropdownUserId(null)
                      setUnlockUser(user)
                    }}
                    disabled={!isUserLocked(user)}
                    className="text-foreground flex cursor-pointer items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icons.Unlock size={16} strokeWidth={1.5} />
                    <span>{t('pages.users.actions.unlock')}</span>
                  </DropdownMenuItem>
                </PermissionGuard>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status toggle - hide for current user */}
          <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
            {currentUser?.id !== String(user.id) && (
              <div className="flex items-center gap-1 sm:gap-2">
                <label className="text-foreground hidden text-xs font-medium sm:inline">
                  {t('pages.users.actions.status')}
                </label>
                <ToggleSwitch
                  checked={isActive(user)}
                  onChange={(checked) => handleStatusToggle(user, checked)}
                  ariaLabel={`${isActive(user) ? t('pages.users.actions.deactivate') : t('pages.users.actions.activate')} user ${user.username}`}
                />
              </div>
            )}
          </PermissionGuard>
        </div>
      ),
    },
  ]

  return (
    <TooltipProvider delayDuration={200}>
      <div>
        {/* Page Header */}
        <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-foreground text-xl font-light sm:text-2xl">
              {t('pages.users.title')}
            </h1>
            <span className="text-muted-foreground text-sm font-light sm:text-base">
              {totalUsers}
            </span>
          </div>

          <PermissionGuard permission={PERMISSIONS.USERS.CREATE}>
            {/* Desktop: Full button with text, Mobile: Icon-only button */}
            <div className="hidden sm:block">
              <DoubleButton
                size="md"
                icon={<Icons.Add size={20} strokeWidth={2} />}
                iconPosition="left"
                onClick={() => setShowCreateModal(true)}
              >
                {t('pages.users.addNewUser')}
              </DoubleButton>
            </div>
            {/* Mobile: Icon-only button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary-300 text-primary-foreground hover:bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none sm:hidden"
              aria-label={t('pages.users.addNewUser')}
            >
              <Icons.Add size={20} strokeWidth={2} />
            </button>
          </PermissionGuard>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex w-full items-center gap-4">
          <div className="flex items-center gap-3">
            <UserSearchBar
              value={searchQuery}
              searchField={searchField}
              onValueChange={handleSearchQueryChange}
              onSearchFieldChange={handleSearchFieldChange}
              onSearch={handleSearch}
              onClear={handleClearSearch}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Filter panel */}
        <div className="mb-4 flex justify-end">
          <FilterTemplatesMenu
            currentFilters={currentTemplateDocument}
            onApply={handleApplyTemplate}
          />
        </div>

        <UserFiltersBar
          filters={filterState}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {/* Loading State */}
        {isLoading && <TableSkeleton columns={columns.length} rows={pageSize} />}

        {/* Error State */}
        {isError && (
          <ErrorState
            error={error}
            onRetry={() => window.location.reload()}
            title={t('pages.users.errorLoading')}
          />
        )}

        {/* User Table */}
        {!isLoading && !isError && (
          <DataTable
            columns={columns}
            data={users}
            emptyMessage={t('pages.users.noUsersFound')}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
        )}

        {/* Pagination */}
        {!isLoading && !isError && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              setCurrentPage(1) // Reset to first page when changing page size
            }}
          />
        )}

        {/* Modals */}
        {showCreateModal && (
          <CreateUserModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateSuccess}
          />
        )}

        {viewUserId && (
          <UserDetailModal
            open={viewUserId !== null}
            userId={viewUserId}
            onClose={handleCloseView}
          />
        )}

        {editUserId && (
          <EditUserModal
            open={editUserId !== null}
            userId={editUserId}
            onClose={handleCloseEdit}
            onSuccess={handleEditSuccess}
          />
        )}

        {changeStatusUser && (
          <ChangeStatusModal
            open={changeStatusUser !== null}
            user={changeStatusUser}
            newStatus={newStatus}
            onClose={() => setChangeStatusUser(null)}
          />
        )}

        {resetPasswordUser && (
          <ResetPasswordConfirmModal
            open={resetPasswordUser !== null}
            user={resetPasswordUser}
            onClose={() => setResetPasswordUser(null)}
          />
        )}

        {toggleTwoFactorUser && (
          <AdminToggleTwoFactorModal
            open={toggleTwoFactorUser !== null}
            user={toggleTwoFactorUser}
            onClose={() => setToggleTwoFactorUser(null)}
          />
        )}

        {unlockUser && (
          <UnlockAccountModal
            open={unlockUser !== null}
            user={unlockUser}
            onClose={() => setUnlockUser(null)}
          />
        )}
      </div>
    </TooltipProvider>
  )
}

export default UserManagementPage
