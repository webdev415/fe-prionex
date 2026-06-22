import { MOCK_ASSIGNMENTS, MOCK_MATERIALS, MOCK_TESTS } from '../../mocks/trainerWorkplaceMocks'
import type { TrainingsAndSessionsSubTabId } from '../../types'

/** Badge counts for the Figma sub-tab strip (`Button on tab with numbers`).
 *
 * Surfaces wired to real data report 0 here; their real counts come from each
 * tab's own list endpoint `total` when the view loads. The remaining
 * mock-backed sub-tabs keep their mock lengths until they're wired. */
export const TRAINING_SUB_TAB_COUNTS: Record<TrainingsAndSessionsSubTabId, number> = {
  courses: 0,
  'group-trainings': 0,
  drills: 0,
  calendar: 0,
  tests: MOCK_TESTS.length,
  assignments: MOCK_ASSIGNMENTS.length,
  materials: MOCK_MATERIALS.length,
  'call-library': 0,
}
