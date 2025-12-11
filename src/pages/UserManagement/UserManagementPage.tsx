/**
 * User Management Page
 *
 * Main page component for managing system users.
 * Integrated with real API using React Query.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

const ITEMS_PER_PAGE = 10

export function UserManagementPage() {
  const navigate = useNavigate()
  const { startImpersonation, user: currentUser, isLoading: authLoading } = useAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewUserId, setViewUserId] = useState<number | null>(null)
  const [editUserId, setEditUserId] = useState<number | null>(null)
  const [unlockUser, setUnlockUser] = useState<ApiUser | null>(null)
  const [impersonatingUserId, setImpersonatingUserId] = useState<number | null>(null)

  // Fetch users with pagination
  const { data, isLoading, isError, error } = useUsers({
    page: currentPage,
    page_size: ITEMS_PER_PAGE,
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
      toast.success(`Now viewing as ${user.username}`)

      // Redirect to dashboard to avoid permission issues
      // (impersonated user may not have access to current page)
      navigate('/dashboard')
    } catch (error: unknown) {
      console.error('Failed to impersonate user:', error)
      const err = error as { message?: string }
      toast.error(err.message || 'Failed to impersonate user')
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
      header: 'Username',
      render: (user) => <span className="font-medium">{user.username}</span>,
    },
    {
      key: 'fullName',
      header: 'Full Name',
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
      header: 'Email',
      render: (user) => <span className="text-gray-700">{user.email || '-'}</span>,
    },
    {
      key: 'projectRole',
      header: 'Project & Role',
      render: (user) => {
        // Display project name with role: "Project Name (Role)"
        if (user.projects && user.projects.length > 0) {
          const projectRoles = user.projects.map((p) => {
            const projectName = p.project_name || 'Unknown Project'
            const roleName = p.role_name || 'No Role'
            return (
              <div key={`${p.project_id}-${p.role_id}`} className="py-0.5">
                <span className="font-medium">{projectName}</span>
                <span className="text-gray-600"> ({roleName})</span>
              </div>
            )
          })
          return <div className="flex flex-col gap-0.5">{projectRoles}</div>
        }
        return <span className="text-gray-500">No assignment</span>
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (user) => <StatusBadge status={getStatusType(user.status)} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (user) => (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleView(user)}
            className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
          >
            <Icons.View size={16} color="#05040D" strokeWidth={1.5} />
            View
          </button>

          <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
            <button
              onClick={() => handleEdit(user)}
              className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            >
              <Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />
              Edit
            </button>
          </PermissionGuard>

          <PermissionGuard permission={PERMISSIONS.USERS.IMPERSONATE}>
            {currentUser?.id !== String(user.id) && (
              <button
                onClick={() => handleImpersonate(user)}
                disabled={authLoading || impersonatingUserId !== null}
                className="text-dark-500 flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icons.SecurityValidation size={16} color="#05040D" strokeWidth={1.5} />
                {impersonatingUserId === user.id ? 'Impersonating...' : 'Impersonate'}
              </button>
            )}
          </PermissionGuard>
          <div className="flex items-center gap-2">
            <label className="text-dark-500 text-xs font-medium">Unlock</label>
            <ToggleSwitch
              checked={isUnlocked(user)}
              onChange={(checked) => handleUnlockToggle(user, checked)}
              ariaLabel={`${isUnlocked(user) ? 'Lock' : 'Unlock'} user ${user.username}`}
            />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-dark-500 text-2xl font-light">User Management</h1>
          <span className="text-base font-light text-gray-500">{totalUsers}</span>
        </div>

        <PermissionGuard permission={PERMISSIONS.USERS.CREATE}>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
            aria-label="Add new user"
          >
            <div className="bg-primary-300 ml-1 flex h-10 w-10 items-center justify-center rounded-full">
              <Icons.Add size={20} color={'#05040D'} strokeWidth={2} />
            </div>
            <span className="px-4 py-3 text-sm font-medium text-white">Add New User</span>
          </button>
        </PermissionGuard>
      </div>

      {/* Loading State */}
      {isLoading && <TableSkeleton columns={columns.length} rows={ITEMS_PER_PAGE} />}

      {/* Error State */}
      {isError && (
        <ErrorState
          error={error}
          onRetry={() => window.location.reload()}
          title="Error loading users"
        />
      )}

      {/* User Table */}
      {!isLoading && !isError && (
        <DataTable columns={columns} data={users} emptyMessage="No users found" />
      )}

      {/* Pagination */}
      {!isLoading && !isError && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
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
