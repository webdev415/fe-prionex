/**
 * UserTable Component
 *
 * Main table component that displays users in a structured table format.
 * - Renders table header with column titles
 * - Renders user rows with data
 * - Handles empty state
 * - Provides edit and delete actions
 *
 * @example
 * <UserTable
 *   users={users}
 *   onEdit={(user) => handleEdit(user)}
 *   onDelete={(user) => handleDelete(user)}
 * />
 */

import type { User } from '@/types/user'
import { UserTableHeader } from './UserTableHeader'
import { UserTableRow } from './UserTableRow'

interface UserTableProps {
  /** Array of users to display */
  users: User[]
  /** Handler for edit action */
  onEdit: (user: User) => void
  /** Handler for delete action */
  onDelete: (user: User) => void
}

export function UserTable({ users, onEdit, onDelete }: UserTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow-md">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <UserTableHeader />
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {users.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                No users found
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <UserTableRow key={user.id} user={user} onEdit={onEdit} onDelete={onDelete} />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default UserTable
