/**
 * `/dashboard/planning/t/:key` — the permanent link of a task (AD-35, FR-15).
 * Until the full-page task (C-05) exists it opens the task panel over «Мої задачі».
 */
import { Navigate, useParams } from 'react-router-dom'
import { PLANNER_TASKS_PATH } from './plannerFormat'

export function PlannerTaskLinkRedirect() {
  const { key = '' } = useParams()
  const search = key ? `?${new URLSearchParams({ task: key }).toString()}` : ''
  return <Navigate to={`${PLANNER_TASKS_PATH}${search}`} replace />
}

export default PlannerTaskLinkRedirect
