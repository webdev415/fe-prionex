/**
 * ViewUserForm Component
 *
 * Read-only form for viewing user information.
 * Displays information as plain text with the same 2-column layout as CreateUserForm.
 */

import { useTranslation } from 'react-i18next'
import type { UserDetailResponse } from '../types'

interface ViewUserFormProps {
  user: UserDetailResponse
}

export function ViewUserForm({ user }: ViewUserFormProps) {
  const { t } = useTranslation('common')

  // Check if user data is available
  if (!user) {
    return (
      <div className="py-8 text-center text-gray-600">
        {t('pages.users.modals.view.userNotFound')}
      </div>
    )
  }

  const getLanguageLabel = (lang: string) => {
    switch (lang) {
      case 'uk':
        return t('language.uk')
      case 'en':
        return t('language.en')
      default:
        return lang
    }
  }

  return (
    <div className="space-y-6">
      {/* User Credentials Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.username')}
            </span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {user.username || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">{t('pages.users.forms.email')}</span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {user.email || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Name Fields Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.firstName')}
            </span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {user.first_name || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.lastName')}
            </span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {user.last_name || '—'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.middleName')}
            </span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {user.middle_name || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">{t('pages.users.forms.phone')}</span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {user.phone || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.language')}
            </span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {getLanguageLabel(user.language || '')}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.timezone')}
            </span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {user.timezone || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Call Settings Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">Asterisk Extension:</span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {user.asterisk_extension || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-sm font-light text-gray-500">Is Agent:</span>
            <span className="text-sm font-semibold break-words text-gray-950">
              {user.is_agent ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {user.is_agent && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-sm font-light text-gray-500">Agent Status:</span>
              <div className="flex items-center gap-2">
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
                <span className="text-sm font-semibold text-gray-950 capitalize">
                  {user.agent_status || 'offline'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-gray-200"></div>
      </div>

      {/* Assign Projects Section */}
      {user.projects && user.projects.length > 0 && (
        <div className="space-y-4">
          <div>
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.assignProjects')}
            </span>
          </div>
          <div className="space-y-3">
            {user.projects.map((project) => (
              <div
                key={project.project_id}
                className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-2 sm:gap-4"
              >
                <span className="text-sm font-light text-gray-500">{project.project_name}:</span>
                <span className="text-sm font-semibold break-words text-gray-950">
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
