/**
 * UserDetail Component
 *
 * Displays detailed information about a user including:
 * - Personal information
 * - Account status
 * - Project assignments
 * - Action buttons (Edit, Deactivate/Reactivate, Reset Password, Unlock)
 */

import { format } from 'date-fns'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import type { User } from '@/types/api'

interface UserDetailProps {
  user: User
  onEdit?: () => void
  onDeactivate?: () => void
  onReactivate?: () => void
  onResetPassword?: () => void
  onUnlock?: () => void
  onBack?: () => void
}

export function UserDetail({
  user,
  onEdit,
  onDeactivate,
  onReactivate,
  onResetPassword,
  onUnlock,
  onBack,
}: UserDetailProps) {
  const isLocked = !!user.locked_until
  const isActive = user.status === 'active'
  const fullName = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ')

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">{user.username}</h1>
          <p className="mt-1 text-gray-400">{user.email}</p>
        </div>

        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack} aria-label="Back">
              Back
            </Button>
          )}

          {onEdit && (
            <Button variant="outline" onClick={onEdit} aria-label="Edit user">
              Edit
            </Button>
          )}

          {isActive && onDeactivate ? (
            <Button variant="outline" onClick={onDeactivate} aria-label="Deactivate user">
              Deactivate
            </Button>
          ) : (
            !isActive &&
            onReactivate && (
              <Button variant="outline" onClick={onReactivate} aria-label="Reactivate user">
                Reactivate
              </Button>
            )
          )}

          {onResetPassword && (
            <Button variant="outline" onClick={onResetPassword} aria-label="Reset password">
              Reset Password
            </Button>
          )}

          {isLocked && onUnlock && (
            <Button variant="outline" onClick={onUnlock} aria-label="Unlock account">
              Unlock
            </Button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
            user.status === 'active'
              ? 'bg-green-100 text-green-800'
              : user.status === 'inactive'
                ? 'bg-gray-100 text-gray-800'
                : 'bg-red-100 text-red-800'
          }`}
        >
          {user.status}
        </span>

        {isLocked && (
          <span className="ml-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
            Locked until {format(new Date(user.locked_until!), 'MMM d, yyyy HH:mm')}
          </span>
        )}
      </div>

      {/* Personal Information Card */}
      <Card>
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Personal Information</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-gray-400">Full Name</dt>
              <dd className="mt-1 text-sm text-white">{fullName}</dd>
            </div>

            <div>
              <dt className="text-sm text-gray-400">Email</dt>
              <dd className="mt-1 text-sm text-white">{user.email}</dd>
            </div>

            {user.phone && (
              <div>
                <dt className="text-sm text-gray-400">Phone</dt>
                <dd className="mt-1 text-sm text-white">{user.phone}</dd>
              </div>
            )}

            <div>
              <dt className="text-sm text-gray-400">Language</dt>
              <dd className="mt-1 text-sm text-white">{user.language.toUpperCase()}</dd>
            </div>

            <div>
              <dt className="text-sm text-gray-400">Timezone</dt>
              <dd className="mt-1 text-sm text-white">{user.timezone}</dd>
            </div>

            {user.last_login_at && (
              <div>
                <dt className="text-sm text-gray-400">Last Login</dt>
                <dd className="mt-1 text-sm text-white">
                  {format(new Date(user.last_login_at), 'MMM d, yyyy HH:mm')}
                </dd>
              </div>
            )}

            <div>
              <dt className="text-sm text-gray-400">Account Created</dt>
              <dd className="mt-1 text-sm text-white">
                {format(new Date(user.created_at), 'MMM d, yyyy')}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-400">Failed Login Attempts</dt>
              <dd className="mt-1 text-sm text-white">{user.failed_login_attempts}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Project Assignments Card */}
      <Card>
        <div className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Project Assignments</h2>

          {!user.projects || user.projects.length === 0 ? (
            <p className="text-sm text-gray-400">No projects assigned</p>
          ) : (
            <div className="space-y-3">
              {user.projects.map((project) => (
                <div
                  key={project.project_id}
                  className="flex items-center justify-between rounded-lg border border-gray-700 p-4"
                >
                  <div>
                    <div className="font-medium text-white">{project.project_name}</div>
                    <div className="text-sm text-gray-400">{project.project_code}</div>
                  </div>
                  <div className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                    {project.role_name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
