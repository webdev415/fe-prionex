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
      case 'ru':
        return t('language.ru')
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
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.username')}
            </span>
            <span className="text-sm font-semibold text-gray-950">{user.username || '—'}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-gray-500">{t('pages.users.forms.email')}</span>
            <span className="text-sm font-semibold text-gray-950">{user.email || '—'}</span>
          </div>
        </div>
      </div>

      {/* Name Fields Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.firstName')}
            </span>
            <span className="text-sm font-semibold text-gray-950">{user.first_name || '—'}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.lastName')}
            </span>
            <span className="text-sm font-semibold text-gray-950">{user.last_name || '—'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.middleName')}
            </span>
            <span className="text-sm font-semibold text-gray-950">{user.middle_name || '—'}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-gray-500">{t('pages.users.forms.phone')}</span>
            <span className="text-sm font-semibold text-gray-950">{user.phone || '—'}</span>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.language')}
            </span>
            <span className="text-sm font-semibold text-gray-950">
              {getLanguageLabel(user.language || '')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-light text-gray-500">
              {t('pages.users.forms.timezone')}
            </span>
            <span className="text-sm font-semibold text-gray-950">{user.timezone || '—'}</span>
          </div>
        </div>
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
              <div key={project.project_id} className="grid w-full grid-cols-2 items-center gap-4">
                <span className="text-sm font-light text-gray-500">{project.project_name}:</span>
                <span className="text-sm font-semibold text-gray-950">{project.role_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
