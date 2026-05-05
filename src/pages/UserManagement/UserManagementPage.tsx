/**
 * User Management Page
 *
 * Main page component for managing system users.
 * Integrated with real API using React Query.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
import type { ApiUser } from '@/features/users/types'
import { Icons } from '@/lib/icons'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { ErrorState } from '@/components/ErrorState'
import { LinkButton } from '@/components/ui/LinkButton'
import { DoubleButton } from '@/components/ui/DoubleButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

const DEFAULT_PAGE_SIZE = 10

export function UserManagementPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { startImpersonation, user: currentUser, isLoading: authLoading } = useAuth()

  // URL state for pagination and search
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [pageSize, setPageSize] = useURLState<number>('pageSize', DEFAULT_PAGE_SIZE)
  const [searchQuery, setSearchQuery] = useURLState<string>('search', '')

  // Add persistence for state
  useAutoPersistedState(
    'user-management-state',
    {
      currentPage,
      pageSize,
      searchQuery,
    },
    {
      currentPage: setCurrentPage,
      pageSize: setPageSize,
      searchQuery: setSearchQuery,
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

  // Fetch users with pagination and search
  const { data, isLoading, isError, error } = useUsers({
    page: currentPage,
    page_size: pageSize,
    search: searchQuery || undefined,
  })

  const users = data?.users || []
  const totalUsers = data?.pagination.total_count || 0
  const totalPages = data?.pagination.total_pages || 0

  const handleCloseView = () => {
    setViewUserId(null)
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

  // Check if user is active (for toggle state)
  const isActive = (user: ApiUser) => {
    return user.status === 'active'
  }

  // Table columns definition
  const columns: Column<ApiUser>[] = [
    {
      key: 'id',
      header: t('pages.users.tableHeaders.userId'),
      render: (user) => <span className="text-gray-700">{user.id}</span>,
    },
    {
      key: 'username',
      header: t('pages.users.tableHeaders.username'),
      render: (user) => <span className="font-medium">{user.username}</span>,
    },
    {
      key: 'fullName',
      header: t('pages.users.tableHeaders.fullName'),
      render: (user) => <span>{user.full_name || '-'}</span>,
    },
    {
      key: 'email',
      header: t('pages.users.tableHeaders.email'),
      render: (user) => <span className="text-gray-700">{user.email || '-'}</span>,
    },
    {
      key: 'projectRole',
      header: t('pages.users.tableHeaders.projectRole'),
      render: (user) => {
        // Display project name with role: "Project Name (Role)"
        if (user.projects && user.projects.length > 0) {
          const projectRoles = user.projects.map((p) => {
            const projectName = p.project_name || t('pages.users.unknownProject')
            const roleName = p.role_name || t('pages.users.noRole')
            return (
              <div key={`${p.project_id}-${p.role_id}`} className="py-0.5">
                <span className="font-medium">{projectName}</span>
                <span className="text-gray-600"> ({roleName})</span>
              </div>
            )
          })
          return <div className="flex flex-col gap-0.5">{projectRoles}</div>
        }
        return <span className="text-gray-500">{t('pages.users.noAssignment')}</span>
      },
    },
    {
      key: 'extension',
      header: t('pages.users.tableHeaders.extension'),
      align: 'center',
      render: (user) => (
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-gray-700">{user.asterisk_extension || '—'}</span>
          {user.is_agent && (
            <div className="flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${
                  user.agent_status === 'online'
                    ? 'bg-green-500'
                    : user.agent_status === 'busy'
                      ? 'bg-yellow-500'
                      : user.agent_status === 'on-call'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                }`}
              />
              <span className="text-xs text-gray-500 capitalize">
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
      render: (user) => <StatusBadge status={getStatusType(user.status)} />,
    },
    {
      key: 'actions',
      header: t('pages.users.tableHeaders.actions'),
      align: 'center',
      render: (user) => (
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {/* Desktop: Individual link buttons */}
          <div className="hidden items-center gap-4 lg:flex">
            <LinkButton
              variant="regular-black"
              size="xs"
              onClick={() => handleView(user)}
              leftIcon={<Icons.View size={16} color="#05040D" strokeWidth={1.5} />}
            >
              {t('pages.users.actions.view')}
            </LinkButton>
            <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleEdit(user)}
                leftIcon={<Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {t('pages.users.actions.edit')}
              </LinkButton>
            </PermissionGuard>

            <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
              {currentUser?.id !== String(user.id) && (
                <LinkButton
                  variant="regular-black"
                  size="xs"
                  onClick={() => setResetPasswordUser(user)}
                  leftIcon={<Icons.LockSync01 size={16} color="#05040D" strokeWidth={1.5} />}
                >
                  {t('pages.users.actions.resetPassword')}
                </LinkButton>
              )}
            </PermissionGuard>

            <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
              {currentUser?.id !== String(user.id) &&
                (user.two_factor_enabled || user.two_factor_has_secret) && (
                  <LinkButton
                    variant="regular-black"
                    size="xs"
                    onClick={() => setToggleTwoFactorUser(user)}
                    leftIcon={<Icons.Shield size={16} color="#05040D" strokeWidth={1.5} />}
                  >
                    {user.two_factor_enabled
                      ? t('pages.users.actions.disableTwoFactor')
                      : t('pages.users.actions.reenableTwoFactor')}
                  </LinkButton>
                )}
            </PermissionGuard>

            <PermissionGuard permission={PERMISSIONS.USERS.IMPERSONATE}>
              {currentUser?.id !== String(user.id) && (
                <LinkButton
                  variant="regular-black"
                  size="xs"
                  onClick={() => handleImpersonate(user)}
                  disabled={authLoading || impersonatingUserId !== null}
                  leftIcon={
                    <Icons.SecurityValidation size={16} color="#05040D" strokeWidth={1.5} />
                  }
                >
                  {impersonatingUserId === user.id
                    ? t('pages.users.actions.impersonating')
                    : t('pages.users.actions.impersonate')}
                </LinkButton>
              )}
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
                  className="text-dark-500 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white transition-colors hover:bg-gray-100 focus:outline-none"
                  aria-label={t('pages.users.tableHeaders.actions')}
                >
                  <Icons.FilterVertical size={16} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white">
                <DropdownMenuItem
                  onClick={() => handleView(user)}
                  className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Icons.View size={16} strokeWidth={1.5} />
                  <span>{t('pages.users.actions.view')}</span>
                </DropdownMenuItem>
                <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
                  <DropdownMenuItem
                    onClick={() => handleEdit(user)}
                    className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
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
                      className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
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
                        className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
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
                      className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Status toggle - hide for current user */}
          <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
            {currentUser?.id !== String(user.id) && (
              <div className="flex items-center gap-1 sm:gap-2">
                <label className="text-dark-500 hidden text-xs font-medium sm:inline">
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
    <div>
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">{t('pages.users.title')}</h1>
          <span className="text-sm font-light text-gray-500 sm:text-base">{totalUsers}</span>
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
            className="bg-primary-300 text-dark-500 hover:bg-primary-500 flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none sm:hidden"
            aria-label={t('pages.users.addNewUser')}
          >
            <Icons.Add size={20} strokeWidth={2} />
          </button>
        </PermissionGuard>
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex w-full items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex w-[280px] items-center gap-3 rounded-full border border-gray-200 bg-white pr-2 pl-4 shadow-sm sm:w-[400px] md:w-[500px] lg:w-[600px]">
            <div className="flex flex-1 items-center gap-2 py-1">
              <input
                type="text"
                placeholder={t('pages.users.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                className="text-dark-500 h-9 w-full bg-transparent text-sm font-light outline-none placeholder:text-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
                  type="button"
                  aria-label="Clear search"
                >
                  <Icons.Close size={14} className="text-gray-500" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={isLoading}
              className="bg-primary-300 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-60"
              aria-label={t('pages.users.searchButton')}
            >
              <Icons.Search size={18} className="text-dark-500" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

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
        <DataTable columns={columns} data={users} emptyMessage={t('pages.users.noUsersFound')} />
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
        <UserDetailModal open={viewUserId !== null} userId={viewUserId} onClose={handleCloseView} />
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
    </div>
  )
}

export default UserManagementPage
