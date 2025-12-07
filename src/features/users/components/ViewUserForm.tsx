/**
 * ViewUserForm Component
 *
 * Read-only form for viewing user information.
 * Matches the CreateUserForm layout and styling.
 */

import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { colors } from '@/lib/colors'
import type { UserDetailResponse } from '../types'

interface ViewUserFormProps {
  user: UserDetailResponse
}

export function ViewUserForm({ user }: ViewUserFormProps) {
  // Check if user data is available
  if (!user) {
    return <div className="py-8 text-center text-gray-600">No user data available</div>
  }

  return (
    <div className="space-y-6">
      {/* User Credentials Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username">Username:</Label>
            <Input
              id="username"
              value={user.username || ''}
              disabled
              className="mt-1"
              style={{ backgroundColor: '#F9FAFB' }}
            />
          </div>

          <div>
            <Label htmlFor="email">Email:</Label>
            <Input
              id="email"
              type="email"
              value={user.email || ''}
              disabled
              className="mt-1"
              style={{ backgroundColor: '#F9FAFB' }}
            />
          </div>
        </div>
      </div>

      {/* Name Fields Section */}
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name">First Name:</Label>
            <Input
              id="first_name"
              value={user.first_name || ''}
              disabled
              className="mt-1"
              style={{ backgroundColor: '#F9FAFB' }}
            />
          </div>

          <div>
            <Label htmlFor="last_name">Last Name:</Label>
            <Input
              id="last_name"
              value={user.last_name || ''}
              disabled
              className="mt-1"
              style={{ backgroundColor: '#F9FAFB' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="middle_name">Middle Name:</Label>
            <Input
              id="middle_name"
              value={user.middle_name || ''}
              disabled
              className="mt-1"
              style={{ backgroundColor: '#F9FAFB' }}
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone:</Label>
            <Input
              id="phone"
              type="tel"
              value={user.phone || ''}
              disabled
              className="mt-1"
              style={{ backgroundColor: '#F9FAFB' }}
            />
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="language">Language:</Label>
            <div
              className="mt-1 w-full rounded-md border px-3 py-2"
              style={{
                borderColor: colors.light[100],
                backgroundColor: '#F9FAFB',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                fontWeight: 300,
                color: colors.gray[950],
              }}
            >
              {user.language === 'uk'
                ? 'Ukrainian'
                : user.language === 'ru'
                  ? 'Russian'
                  : 'English'}
            </div>
          </div>

          <div>
            <Label htmlFor="timezone">Timezone:</Label>
            <div
              className="mt-1 w-full rounded-md border px-3 py-2"
              style={{
                borderColor: colors.light[100],
                backgroundColor: '#F9FAFB',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '14px',
                fontWeight: 300,
                color: colors.gray[950],
              }}
            >
              {user.timezone}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Projects Section */}
      {user.projects && user.projects.length > 0 && (
        <div className="mt-4 space-y-4">
          <h3
            className="text-sm font-semibold"
            style={{ color: colors.neutral.dark[500], fontSize: '14px' }}
          >
            Assigned Projects:
          </h3>
          <div className="space-y-3">
            {user.projects.map((project) => (
              <div key={project.project_id} className="grid w-full grid-cols-2 items-center gap-4">
                <span className="text-sm font-light" style={{ color: colors.neutral.dark[500] }}>
                  {project.project_name}:
                </span>
                <div
                  className="w-full rounded-md border px-3"
                  style={{
                    borderColor: colors.light[100],
                    backgroundColor: '#F9FAFB',
                    color: colors.gray[950],
                    fontSize: '14px',
                    fontWeight: 300,
                    height: '45px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {project.role_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
