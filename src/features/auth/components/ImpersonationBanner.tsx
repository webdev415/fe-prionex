/**
 * ImpersonationBanner Component
 *
 * Banner displayed at the bottom of the page when an admin
 * is impersonating another user.
 */

import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'

export interface ImpersonationBannerProps {
  isImpersonating: boolean
  impersonatedUser: {
    id: string
    username: string
    email?: string
    firstName?: string
    lastName?: string
    active_role_name?: string | null
    active_project_id?: string | null
    projects?: Array<{
      id: string
      name: string
    }>
  } | null
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
    <div className="w-full flex items-center justify-center">
      <div
        className="w-[80%] xl:w-[60%] h-[65px] bg-white flex items-center justify-between rounded-md"
        style={{
          color: colors.neutral.dark[500],
          fontSize: '16px',
          paddingLeft: '24px',
          paddingRight: '20px',
        }}
      >
        <div
          className="font-medimun flex items-center gap-2"
          style={{
            color: colors.secondary[800],
          }}
        >
          <Icons.UserCircle02Icon size={20} color={colors.secondary[800]} strokeWidth={1.5} />
          Impersonation mode
        </div>
        <div className='font-light'>
          Viewing as:{' '}
          <span className="font-medium">
            {impersonatedUser.username}({roleName})
          </span>
        </div>
        <div className='font-light'>
          Project: {' '}
          <span className="font-medium">
            {projectName}
          </span>
        </div>
        <button
          onClick={onExitImpersonation}
          disabled={isLoading}
          className="rounded-sm flex items-center justify-center gap-2"
          style={{
            color: colors.neutral.dark[500],
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            backgroundColor: colors.primary[300],
            cursor: isLoading ? 'not-allowed' : 'pointer',
            height: '41px',
            width: '189px',
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          {isLoading ? 'Exiting...' : 'Exit Impersonation'}
          <Icons.LogoutSquare01 size={20} color={colors.neutral.dark[500]} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
