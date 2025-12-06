/**
 * UserTableRow Component
 *
 * Renders a single user's data in a table row.
 * - Displays username, email, phone, role, projects, status
 * - Provides Edit and Delete action buttons
 * - Uses StatusBadge and ProjectTags components
 *
 * @example
 * <UserTableRow
 *   user={user}
 *   onEdit={(user) => handleEdit(user)}
 *   onDelete={(user) => handleDelete(user)}
 * />
 */

import type { User } from '@/types/user'
import { StatusBadge } from './StatusBadge'

interface UserTableRowProps {
  /** User data to display */
  user: User
  /** Handler for edit action */
  onEdit: (user: User) => void
  /** Handler for delete action */
  onDelete?: (user: User) => void
}

export function UserTableRow({ user, onEdit }: UserTableRowProps) {
  return (
    <tr className="border-b transition-colors hover:bg-gray-50/50">
      {/* Username */}
      <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.username}</td>

      {/* Role */}
      <td className="px-6 py-4 text-sm text-gray-700">{user.role}</td>

      {/* Status */}
      <td className="px-6 py-4 text-sm">
        <StatusBadge status={user.status} />
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-sm">
        <div className="flex items-center gap-4">
          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(user)}
            className="flex items-center gap-1.5 text-gray-700 transition-colors hover:text-gray-900"
            aria-label="Edit user"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span className="font-medium">Edit</span>
          </button>

          {/* Impersonate */}
          <button
            type="button"
            onClick={() => console.log('Impersonate', user.username)}
            className="flex items-center gap-1.5 text-gray-700 transition-colors hover:text-gray-900"
            aria-label="Impersonate user"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span className="font-medium">Impersonate</span>
          </button>

          {/* Unlock Toggle (conditional) */}
          {user.status === 'Active' && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-700">Unlock</span>
              <button
                type="button"
                role="switch"
                aria-checked="true"
                className="relative inline-flex h-5 w-9 items-center rounded-full bg-[#204E4D] transition-colors focus:ring-2 focus:ring-[#204E4D] focus:ring-offset-2 focus:outline-none"
              >
                <span className="inline-block h-4 w-4 translate-x-5 transform rounded-full bg-white transition-transform" />
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default UserTableRow
