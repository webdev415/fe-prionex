import { MOCK_TASKS } from '../../mocks/trainerWorkplaceMocks'
import type { TasksSubTabId } from '../../types'

/**
 * Per-chip counts for the Tasks filter row (Figma: All / Today / Tomorrow /
 * Week). Filters operate on `task.timeBucket`.
 */
export const TASKS_SUB_TAB_COUNTS: Record<TasksSubTabId, number> = {
  all: MOCK_TASKS.length,
  today: MOCK_TASKS.filter((t) => t.timeBucket === 'today').length,
  tomorrow: MOCK_TASKS.filter((t) => t.timeBucket === 'tomorrow').length,
  this_week: MOCK_TASKS.filter((t) => t.timeBucket === 'this_week').length,
}

export function filterTasksBySubTab(subTab: TasksSubTabId) {
  switch (subTab) {
    case 'today':
      return MOCK_TASKS.filter((t) => t.timeBucket === 'today')
    case 'tomorrow':
      return MOCK_TASKS.filter((t) => t.timeBucket === 'tomorrow')
    case 'this_week':
      return MOCK_TASKS.filter((t) => t.timeBucket === 'this_week')
    case 'all':
    default:
      return MOCK_TASKS
  }
}
