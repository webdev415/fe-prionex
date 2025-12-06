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
import type { ApiUser } from '@/features/users/types'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'

const ITEMS_PER_PAGE = 10

export function UserManagementPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  // Fetch users with pagination
  const { data, isLoading, isError, error } = useUsers({
    page: currentPage,
    page_size: ITEMS_PER_PAGE,
  })

  const users = data?.users || []
  const totalUsers = data?.pagination.total_count || 0
  const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE)

  // Generate visible page numbers
  const getVisiblePages = () => {
    const pages: number[] = []
    const maxVisible = 3

    let start = Math.max(1, currentPage - 1)
    const end = Math.min(totalPages, start + maxVisible - 1)

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  const handleRowClick = (userId: number) => {
    setSelectedUserId(userId)
  }

  const handleCloseDetail = () => {
    setSelectedUserId(null)
  }

  const handleCreateSuccess = () => {
    setShowCreateModal(false)
  }

  // Map API status to display status
  const getStatusDisplay = (status: ApiUser['status']) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'inactive':
        return 'Inactive'
      case 'suspended':
        return 'Suspended'
      default:
        return status
    }
  }

  // Get status badge color
  const getStatusColor = (status: ApiUser['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'inactive':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
      case 'suspended':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

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
      {isLoading && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: 'rgba(30, 60, 60, 0.6)' }}
        >
          <p className="text-gray-400">Loading users...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: 'rgba(30, 60, 60, 0.6)' }}
        >
          <p className="text-red-400">Error loading users: {error?.message}</p>
        </div>
      )}

      {/* User Table - Dark Theme */}
      {!isLoading && !isError && (
        <div
          className="overflow-hidden rounded-xl"
          style={{ backgroundColor: 'rgba(30, 60, 60, 0.6)' }}
        >
          <table className="min-w-full">
            {/* Table Header */}
            <thead>
              <tr style={{ backgroundColor: 'rgba(40, 70, 70, 0.8)' }}>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                  Username
                </th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                  Email
                </th>
                <th scope="col" className="px-6 py-4 text-left text-sm font-medium text-gray-300">
                  Name
                </th>
                <th scope="col" className="px-6 py-4 text-center text-sm font-medium text-gray-300">
                  Status
                </th>
                <th scope="col" className="px-6 py-4 text-center text-sm font-medium text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-white/5">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr
                    key={user.id}
                    className="cursor-pointer transition-colors hover:bg-white/5"
                    style={{
                      backgroundColor:
                        index % 2 === 0 ? 'rgba(35, 65, 65, 0.5)' : 'rgba(40, 70, 70, 0.4)',
                    }}
                    onClick={() => handleRowClick(user.id)}
                  >
                    {/* Username */}
                    <td className="px-6 py-4 text-sm font-medium text-white">{user.username}</td>

                    {/* Email */}
                    <td className="px-6 py-4 text-sm text-gray-300">{user.email}</td>

                    {/* Name */}
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {user.first_name} {user.last_name}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(user.status)}`}
                      >
                        {getStatusDisplay(user.status)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRowClick(user.id)
                        }}
                        className="text-sm font-medium text-blue-400 hover:text-blue-300"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination - Circular Design */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {/* Previous Arrow */}
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Page Numbers */}
          {getVisiblePages().map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'text-gray-900'
                  : 'border border-white/20 text-white hover:bg-white/10'
              }`}
              style={currentPage === page ? { backgroundColor: '#bbfb5b' } : {}}
              aria-label={`Go to page ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          ))}

          {/* Next Arrow */}
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {selectedUserId && (
        <UserDetailModal
          open={selectedUserId !== null}
          userId={selectedUserId}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  )
}

export default UserManagementPage
