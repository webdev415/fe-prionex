/**
 * User Management Page
 *
 * Main page component for managing system users.
 * Integrated with real API using React Query.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth'
import { useUsers } from '@/features/users/hooks/useUsers'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { CreateUserModal } from './components/CreateUserModal'
import { UserDetailModal } from './components/UserDetailModal'
import { EditUserModal } from './components/EditUserModal'
import UnlockAccountModal from './components/UnlockAccountModal'
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

const DEFAULT_PAGE_SIZE = 10

export function UserManagementPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { startImpersonation, user: currentUser, isLoading: authLoading } = useAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewUserId, setViewUserId] = useState<number | null>(null)
  const [editUserId, setEditUserId] = useState<number | null>(null)
  const [unlockUser, setUnlockUser] = useState<ApiUser | null>(null)
  const [impersonatingUserId, setImpersonatingUserId] = useState<number | null>(null)

  // Fetch users with pagination
  const { data, isLoading, isError, error } = useUsers({
    page: currentPage,
    page_size: pageSize,
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

  const handleUnlockToggle = (user: ApiUser, checked: boolean) => {
    // Only support unlocking via confirmation modal; no manual locking from UI.
    if (checked && !isUnlocked(user)) {
      setUnlockUser(user)
    }
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

  // Check if user is unlocked (for toggle state)
  const isUnlocked = (user: ApiUser) => {
    if (!user.locked_until) return true
    return new Date(user.locked_until) <= new Date()
  }

  // Table columns definition
  const columns: Column<ApiUser>[] = [
    {
      key: 'username',
      header: t('pages.users.tableHeaders.username'),
      render: (user) => <span className="font-medium">{user.username}</span>,
    },
    {
      key: 'fullName',
      header: t('pages.users.tableHeaders.fullName'),
      render: (user) => (
        <span>
          {user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : user.first_name || user.last_name || '-'}
        </span>
      ),
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
        <div className="flex items-center justify-center gap-4">
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

          <PermissionGuard permission={PERMISSIONS.USERS.IMPERSONATE}>
            {currentUser?.id !== String(user.id) && (
              <LinkButton
                variant="regular-black"
                size="xs"
                onClick={() => handleImpersonate(user)}
                disabled={authLoading || impersonatingUserId !== null}
                leftIcon={<Icons.SecurityValidation size={16} color="#05040D" strokeWidth={1.5} />}
              >
                {impersonatingUserId === user.id
                  ? t('pages.users.actions.impersonating')
                  : t('pages.users.actions.impersonate')}
              </LinkButton>
            )}
          </PermissionGuard>
          <div className="flex items-center gap-2">
            <label className="text-dark-500 text-xs font-medium">
              {t('pages.users.actions.unlock')}
            </label>
            <ToggleSwitch
              checked={isUnlocked(user)}
              onChange={(checked) => handleUnlockToggle(user, checked)}
              ariaLabel={`${isUnlocked(user) ? t('pages.users.actions.lock') : t('pages.users.actions.unlock')} user ${user.username}`}
            />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-dark-500 text-2xl font-light">{t('pages.users.title')}</h1>
          <span className="text-base font-light text-gray-500">{totalUsers}</span>
        </div>

        <PermissionGuard permission={PERMISSIONS.USERS.CREATE}>
          <DoubleButton
            size="md"
            icon={<Icons.Add size={20} strokeWidth={2} />}
            iconPosition="left"
            onClick={() => setShowCreateModal(true)}
          >
            {t('pages.users.addNewUser')}
          </DoubleButton>
        </PermissionGuard>
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

      {unlockUser && (
        <UnlockAccountModal
          open={unlockUser !== null}
          user={unlockUser}
          onClose={() => setUnlockUser(null)}
        />
      )}
    </div>
  )
}

export default UserManagementPage
