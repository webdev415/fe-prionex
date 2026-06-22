import {
  MOCK_ASSIGNMENTS,
  MOCK_MATERIALS,
  MOCK_ONE_ON_ONES_PAST,
  MOCK_ONE_ON_ONES_PLANNED,
  MOCK_TESTS,
} from '../../mocks/trainerWorkplaceMocks'
import type { TrainingsAndSessionsSubTabId } from '../../types'

/** Badge counts for the Figma sub-tab strip (`Button on tab with numbers`).
 *
 * Surfaces wired to real data (Courses/Drill Exercises/Group Training Sessions
 * — KAN-750/751/752, and Call Library) report 0 here; their real counts come
 * from each tab's own list endpoint `total` when the view loads. The remaining
 * mock-backed sub-tabs keep their mock lengths until they're wired. */
export const TRAINING_SUB_TAB_COUNTS: Record<TrainingsAndSessionsSubTabId, number> = {
  courses: 0,
  'group-trainings': 0,
  drills: 0,
  calendar: MOCK_ONE_ON_ONES_PLANNED.length + MOCK_ONE_ON_ONES_PAST.length,
  tests: MOCK_TESTS.length,
  assignments: MOCK_ASSIGNMENTS.length,
  materials: MOCK_MATERIALS.length,
  'call-library': 0,
}
