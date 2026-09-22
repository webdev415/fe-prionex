/**
 * ViewUserForm Component
 *
 * Read-only form for viewing user information.
 * Displays information as plain text with the same 2-column layout as CreateUserForm.
 */

import { useTranslation } from 'react-i18next'
import { piiProps } from '@/lib/openreplay/pii'
import type { UserDetailResponse } from '../types'

interface ViewUserFormProps {
  user: UserDetailResponse
}

export function ViewUserForm({ user }: ViewUserFormProps) {
  const { t } = useTranslation('common')

  // Check if user data is available
  if (!user) {
    return (
      <div className="text-muted-foreground py-8 text-center">
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
      case 'ru':
        return t('language.uk')
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
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.username')}
            </span>
            <span className="text-foreground text-sm font-semibold break-words">
              {user.username || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.email')}
            </span>
            <span className="text-foreground text-sm font-semibold break-words">
              {user.email || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Name Fields Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.firstName')}
            </span>
            <span className="text-foreground text-sm font-semibold break-words" {...piiProps}>
              {user.first_name || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.lastName')}
            </span>
            <span className="text-foreground text-sm font-semibold break-words" {...piiProps}>
              {user.last_name || '—'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.middleName')}
            </span>
            <span className="text-foreground text-sm font-semibold break-words" {...piiProps}>
              {user.middle_name || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.phone')}
            </span>
            <span className="text-foreground text-sm font-semibold break-words">
              {user.phone || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.language')}
            </span>
            <span className="text-foreground text-sm font-semibold break-words">
              {getLanguageLabel(user.language || '')}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.timezone')}
            </span>
            <span className="text-foreground text-sm font-semibold break-words">
              {user.timezone || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Call Settings Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">Asterisk Extension:</span>
            <span className="text-foreground text-sm font-semibold break-words">
              {user.asterisk_extension || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.dialerExtension')}:
            </span>
            <span className="text-foreground text-sm font-semibold break-words">
              {user.dialer_extension || '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-muted-foreground text-sm font-light">Is Agent:</span>
            <span className="text-foreground text-sm font-semibold break-words">
              {user.is_agent ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {user.is_agent && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-muted-foreground text-sm font-light">Agent Status:</span>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    user.agent_status === 'online'
                      ? 'bg-success-500'
                      : user.agent_status === 'busy'
                        ? 'bg-warning-500'
                        : user.agent_status === 'on-call'
                          ? 'bg-error-500'
                          : 'bg-muted-foreground'
                  }`}
                />
                <span className="text-foreground text-sm font-semibold capitalize">
                  {user.agent_status || 'offline'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="border-border border-t"></div>
      </div>

      {/* Assign Projects Section */}
      {user.projects && user.projects.length > 0 && (
        <div className="space-y-4">
          <div>
            <span className="text-muted-foreground text-sm font-light">
              {t('pages.users.forms.assignProjects')}
            </span>
          </div>
          <div className="space-y-3">
            {user.projects.map((project) => (
              <div
                key={project.project_id}
                className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-2 sm:gap-4"
              >
                <span className="text-muted-foreground text-sm font-light">
                  {project.project_name}:
                </span>
                <div className="text-foreground text-sm font-semibold break-words">
                  <div>{project.role_name}</div>
                  {(project.department_name || project.group_name) && (
                    <div className="text-muted-foreground text-xs font-normal">
                      {project.department_name && (
                        <span>
                          {t('pages.users.forms.department')}: {project.department_name}
                        </span>
                      )}
                      {project.department_name && project.group_name && ' · '}
                      {project.group_name && (
                        <span>
                          {t('pages.users.forms.group')}: {project.group_name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
