/**
 * ImpersonationBanner Component
 *
 * Banner displayed at the bottom of the page when an admin
 * is impersonating another user.
 */

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
  if (!isImpersonating || !impersonatedUser) {
    return null
  }

  // Find the active project name
  const activeProject = impersonatedUser.projects?.find(
    (p) => p.id === impersonatedUser.active_project_id
  )
  const projectName = activeProject?.name || 'Unknown Project'
  const roleName = impersonatedUser.active_role_name || 'Unknown Role'

  return (
    <div className="flex w-full items-center justify-center">
      <div className="text-dark-500 flex h-[65px] w-[80%] items-center justify-between rounded-md bg-white pr-5 pl-6 text-base xl:w-[60%]">
        <div className="font-medimun text-secondary-800 flex items-center gap-2">
          <Icons.UserCircle02Icon size={20} className="text-secondary-700" strokeWidth={1.5} />
          Impersonation mode
        </div>
        <div className="font-light">
          Viewing as:{' '}
          <span className="font-medium">
            {getUserDisplayName(impersonatedUser)}({roleName})
          </span>
        </div>
        <div className="font-light">
          Project: <span className="font-medium">{projectName}</span>
        </div>
        <button
          onClick={onExitImpersonation}
          disabled={isLoading}
          className="bg-primary-300 text-dark-500 flex h-[41px] w-[189px] items-center justify-center gap-2 rounded-sm border-none text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Exiting...' : 'Exit Impersonation'}
          <Icons.LogoutSquare01 size={20} className="text-dark-500" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
