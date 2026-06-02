import { MOCK_TASKS } from '../../mocks/trainerWorkplaceMocks'
import type { TasksSubTabId } from '../../types'

export const TASKS_SUB_TAB_COUNTS: Record<TasksSubTabId, number> = {
  'assigned-by-me': MOCK_TASKS.filter((t) => t.assignmentScope === 'by_me').length,
  'assigned-to-scope': MOCK_TASKS.filter((t) => t.assignmentScope === 'to_scope').length,
  overdue: MOCK_TASKS.filter((t) => t.status === 'overdue').length,
  completed: MOCK_TASKS.filter((t) => t.status === 'completed').length,
}

export function filterTasksBySubTab(subTab: TasksSubTabId) {
  switch (subTab) {
    case 'assigned-by-me':
      return MOCK_TASKS.filter((t) => t.assignmentScope === 'by_me')
    case 'assigned-to-scope':
      return MOCK_TASKS.filter((t) => t.assignmentScope === 'to_scope')
    case 'overdue':
      return MOCK_TASKS.filter((t) => t.status === 'overdue')
    case 'completed':
      return MOCK_TASKS.filter((t) => t.status === 'completed')
    default:
      return MOCK_TASKS
  }
}
