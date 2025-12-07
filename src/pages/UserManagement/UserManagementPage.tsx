/**
 * User Management Page
 *
 * Main page component for managing system users.
 * Integrated with real API using React Query.
 */

import { useState } from 'react'
import { useUsers } from '@/features/users/hooks/useUsers'
import { CreateUserModal } from './components/CreateUserModal'
import { UserDetailModal } from './components/UserDetailModal'
import { EditUserModal } from './components/EditUserModal'
import { UnlockAccountModal } from './components/UnlockAccountModal'
import type { ApiUser } from '@/features/users/types'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Pagination } from '@/components/ui/Pagination'
import { TableSkeleton } from '@/components/ui/TableSkeleton'

const ITEMS_PER_PAGE = 10

export function UserManagementPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewUserId, setViewUserId] = useState<number | null>(null)
  const [editUserId, setEditUserId] = useState<number | null>(null)
  const [unlockUser, setUnlockUser] = useState<ApiUser | null>(null)

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

  const handleImpersonate = (user: ApiUser) => {
    // TODO: Implement impersonate functionality
    console.log('Impersonate user:', user.id)
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
      render: (user) => (
        <span className="font-medium">
          {user.first_name} {user.last_name}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => {
        // Display roles from projects, or "No role" if none assigned
        if (user.projects && user.projects.length > 0) {
          // Show all roles, separated by comma if multiple
          return <span>{user.projects.map((p) => p.role_name).join(', ')}</span>
        }
        return <span style={{ color: colors.gray[500] }}>No role</span>
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
            className="flex items-center gap-1 font-medium transition-colors hover:opacity-80"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#05040D',
            }}
          >
            <Icons.View size={16} color="#05040D" strokeWidth={1.5} />
            View
          </button>
          <button
            onClick={() => handleEdit(user)}
            className="flex items-center gap-1 font-medium transition-colors hover:opacity-80"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#05040D',
            }}
          >
            <Icons.PencilEdit size={16} color="#05040D" strokeWidth={1.5} />
            Edit
          </button>
          <button
            onClick={() => handleImpersonate(user)}
            className="flex items-center gap-1 font-medium transition-colors hover:opacity-80"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#05040D',
            }}
          >
            <Icons.SecurityValidation size={16} color="#05040D" strokeWidth={1.5} />
            Impersonate
          </button>
          <div className="flex items-center gap-2">
            <label
              className="font-medium"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#05040D',
              }}
            >
              Unlock
            </label>
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
          <h1
            className="font-light"
            style={{
              fontSize: '24px',
              fontWeight: 300,
              color: colors.neutral.dark[500],
            }}
          >
            User Management
          </h1>
          <span
            className="font-light"
            style={{
              fontSize: '16px',
              fontWeight: 300,
              color: colors.gray[500],
            }}
          >
            {totalUsers}
          </span>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
          style={{
            backgroundColor: colors.secondary[800],
          }}
          aria-label="Add new user"
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: colors.primary[300],
              marginLeft: '4px',
            }}
          >
            <Icons.Add size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
          <span
            className="px-4 py-3 font-medium text-white"
            style={{
              fontSize: '14px',
            }}
          >
            Add New User
          </span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && <TableSkeleton columns={columns.length} rows={ITEMS_PER_PAGE} />}

      {/* Error State */}
      {isError && (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <p style={{ color: '#EF4444' }}>Error loading users: {error?.message}</p>
        </div>
      )}

      {/* User Table */}
      {!isLoading && !isError && (
        <DataTable columns={columns} data={users} emptyMessage="No users found" />
      )}

      {/* Pagination */}
      {!isLoading && !isError && totalPages > 1 && (
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
