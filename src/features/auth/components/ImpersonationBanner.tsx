/**
 * ImpersonationBanner Component
 *
 * Banner displayed at the bottom of the page when an admin
 * is impersonating another user.
 */

import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { getUserDisplayName } from '@/lib/mapBackendUser'
import type { User } from '@/types/api'

export interface ImpersonationBannerProps {
  isImpersonating: boolean
  impersonatedUser: User | null
  onExitImpersonation: () => void
  isLoading: boolean
}

export function ImpersonationBanner({
  isImpersonating,
  impersonatedUser,
  onExitImpersonation,
  isLoading,
}: ImpersonationBannerProps) {
  const { t } = useTranslation('common')
  if (!isImpersonating || !impersonatedUser) {
    return null
  }

  const activeProject = impersonatedUser.projects?.find(
    (p) => p.id === impersonatedUser.active_project_id
  )
  const projectName =
    activeProject?.name || t('components.impersonation.unknownProject', 'Unknown Project')
  const roleName =
    impersonatedUser.active_role_name || t('components.impersonation.unknownRole', 'Unknown Role')

  return (
    <div className="flex w-full items-center justify-center">
      <div className="border-border bg-card text-foreground flex h-[65px] w-[80%] items-center justify-between rounded-md border pr-5 pl-6 text-base xl:w-[60%]">
        <div className="text-primary-600 flex items-center gap-2 font-medium">
          <Icons.UserCircle02Icon size={20} className="text-primary-600" strokeWidth={1.5} />
          {t('components.impersonation.mode', 'Impersonation mode')}
        </div>
        <div className="text-muted-foreground font-light">
          {t('components.impersonation.viewingAs', 'Viewing as:')}{' '}
          <span className="text-foreground font-medium">
            {getUserDisplayName(impersonatedUser)}({roleName})
          </span>
        </div>
        <div className="text-muted-foreground font-light">
          {t('components.impersonation.project', 'Project:')}{' '}
          <span className="text-foreground font-medium">{projectName}</span>
        </div>
        <button
          onClick={onExitImpersonation}
          disabled={isLoading}
          className="bg-primary-300 text-primary-foreground flex h-[41px] w-[189px] items-center justify-center gap-2 rounded-sm border-none text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading
            ? t('components.impersonation.exiting', 'Exiting...')
            : t('components.impersonation.exit', 'Exit Impersonation')}
          <Icons.LogoutSquare01 size={20} className="text-primary-foreground" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
