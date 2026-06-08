import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { Icons } from '@/lib/icons'

/**
 * Bottom floating workspace bar — Figma `Popup-Trainer` frame.
 *
 * Visual layout matches the Figma frame; data comes from the real
 * `authStore` (project + role + department) and the cached operator list
 * (count of operators in the active project). Falls back gracefully to
 * placeholders for any field the auth payload doesn't provide.
 *
 * Kept under the legacy `MockWorkspaceBanner` filename so existing imports
 * continue to work; export name is unchanged.
 */
export function MockWorkspaceBanner() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const activeProject = user?.projects?.find(
    (p) => String(p.id) === String(user?.active_project_id)
  )
  const projectName = activeProject?.name
  const departmentName = (user as { active_department_name?: string | null } | null | undefined)
    ?.active_department_name
  const roleName = user?.active_role_name

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-[#ECEFF3] bg-white px-3 py-3 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#204E4D]/10 px-3 py-1 text-xs font-medium text-[#204E4D]">
          {roleName ?? t('pages.training.workspaceBanner.coach', 'Coach')}
        </span>
        <Icons.UserCircle02Icon size={18} className="text-[#204E4D]" />
        <span className="text-base font-medium text-[#204E4D]">
          {t('pages.training.workspaceBanner.label', "Coach's Workspace")}
        </span>
      </div>

      <p className="text-sm font-light text-[#05040D]">
        {projectName ? <span className="text-[#05040D]">· {projectName}</span> : null}
        {projectName && departmentName ? (
          <span className="mx-2 text-[#05040D]/40">·</span>
        ) : null}
        {departmentName
          ? t('pages.training.workspaceBanner.assignedTo', 'You are assigned to {{department}}', {
              department: departmentName,
            })
          : null}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-2 text-sm font-light text-[#05040D]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EBECE8] text-xs font-medium text-[#676767]">
            {operators.length}
          </span>
          {t('pages.training.workspaceBanner.operatorsInOperation', 'operators in operation')}
        </span>
        <button
          type="button"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#BBFB5B] text-[#05040D]"
          aria-label={t('pages.training.workspaceBanner.menu', 'Menu')}
        >
          <Icons.Menu11 size={18} />
        </button>
      </div>
    </div>
  )
}

export default MockWorkspaceBanner
