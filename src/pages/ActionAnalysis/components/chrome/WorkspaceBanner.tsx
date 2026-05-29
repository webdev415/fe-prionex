import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'

/**
 * Bottom-pinned workspace context banner shown across the Trainer Workplace
 * (KAN-413 Figma A-frame). Renders the trainer's project + role + department
 * so the operator under coaching is always anchored to the right context.
 *
 * Pieces are joined by " · " and missing parts are silently omitted, so the
 * banner stays clean for users who don't have a department assigned.
 */
export function WorkspaceBanner() {
  const { t } = useTranslation('common')
  const user = useAuthStore((s) => s.user)

  if (!user) return null

  const activeProject = user.projects?.find((p) => String(p.id) === String(user.active_project_id))
  const projectName = activeProject?.name
  const roleName = user.active_role_name
  const departmentName = (user as { active_department_name?: string | null }).active_department_name

  const parts: string[] = [t('pages.actionAnalysis.workspaceBanner.label', "Coach's Workspace")]
  if (projectName) parts.push(projectName)
  if (departmentName) parts.push(departmentName)

  const assignmentLabel = departmentName
    ? t('pages.actionAnalysis.workspaceBanner.assignedTo', 'You are assigned to {{department}}', {
        department: departmentName,
      })
    : null

  return (
    <div
      role="status"
      className="border-primary-200 bg-primary-50/90 text-primary-900 sticky bottom-0 z-10 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[11px] font-medium backdrop-blur sm:-mx-6 sm:px-6"
    >
      <span>{parts.join(' · ')}</span>
      <span className="text-primary-700/80 flex flex-wrap items-center gap-2">
        {assignmentLabel ? <span>{assignmentLabel}</span> : null}
        {roleName ? (
          <span className="bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 text-[10px] font-semibold">
            {roleName}
          </span>
        ) : null}
      </span>
    </div>
  )
}

export default WorkspaceBanner
