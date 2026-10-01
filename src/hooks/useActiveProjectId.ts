import { useAuthStore } from '@/stores/authStore'

/**
 * The active project as a number, or undefined without one. An id that is not a number
 * counts as none: NaN would pass `!== undefined` and the request would go without a project.
 */
export function useActiveProjectId(): number | undefined {
  const activeProjectId = useAuthStore((state) => state.user?.active_project_id)
  const projectId = activeProjectId ? Number(activeProjectId) : Number.NaN
  return Number.isFinite(projectId) ? projectId : undefined
}
