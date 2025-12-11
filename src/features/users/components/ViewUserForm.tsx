/**
 * ViewUserForm Component
 *
 * Read-only form for viewing user information.
 * Displays information as plain text with the same 2-column layout as CreateUserForm.
 */

import type { UserDetailResponse } from '../types'

interface ViewUserFormProps {
  user: UserDetailResponse
}

export function ViewUserForm({ user }: ViewUserFormProps) {
  // Check if user data is available
  if (!user) {
    return <div className="py-8 text-center text-gray-600">No user data available</div>
  }

  const getLanguageLabel = (lang: string) => {
    switch (lang) {
      case 'uk':
        return 'Ukrainian'
      case 'ru':
        return 'Russian'
      case 'en':
        return 'English'
      default:
        return lang
    }
  }

  return (
    <div className="space-y-6">
      {/* User Credentials Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span
              className="font-light"
              style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
            >
              Username:
            </span>
            <span
              className="font-semibold"
              style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
            >
              {user.username || '—'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="font-light"
              style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
            >
              Email:
            </span>
            <span
              className="font-semibold"
              style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
            >
              {user.email || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Name Fields Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span
              className="font-light"
              style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
            >
              First Name:
            </span>
            <span
              className="font-semibold"
              style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
            >
              {user.first_name || '—'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="font-light"
              style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
            >
              Last Name:
            </span>
            <span
              className="font-semibold"
              style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
            >
              {user.last_name || '—'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span
              className="font-light"
              style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
            >
              Middle Name:
            </span>
            <span
              className="font-semibold"
              style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
            >
              {user.middle_name || '—'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="font-light"
              style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
            >
              Phone:
            </span>
            <span
              className="font-semibold"
              style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
            >
              {user.phone || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span
              className="font-light"
              style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
            >
              Language:
            </span>
            <span
              className="font-semibold"
              style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
            >
              {getLanguageLabel(user.language || '')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="font-light"
              style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
            >
              Timezone:
            </span>
            <span
              className="font-semibold"
              style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
            >
              {user.timezone || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Assign Projects Section */}
      {user.projects && user.projects.length > 0 && (
        <div className="space-y-4">
          <div>
            <span
              className="font-light"
              style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
            >
              Assigned Projects:
            </span>
          </div>
          <div className="space-y-3">
            {user.projects.map((project) => (
              <div key={project.project_id} className="grid w-full grid-cols-2 items-center gap-4">
                <span
                  className="font-light"
                  style={{ fontSize: '14px', fontWeight: 300, color: '#6B7280' }}
                >
                  {project.project_name}:
                </span>
                <span
                  className="font-semibold"
                  style={{ fontSize: '14px', fontWeight: 600, color: '#030712' }}
                >
                  {project.role_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
