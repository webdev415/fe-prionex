import {
  MOCK_ASSIGNMENTS,
  MOCK_COURSES,
  MOCK_DRILLS,
  MOCK_GROUP_TRAININGS,
  MOCK_MATERIALS,
  MOCK_ONE_ON_ONES_PAST,
  MOCK_ONE_ON_ONES_PLANNED,
  MOCK_TESTS,
} from '../../mocks/trainerWorkplaceMocks'
import type { TrainingsAndSessionsSubTabId } from '../../types'

/** Badge counts for the Figma sub-tab strip (`Button on tab with numbers`). */
export const TRAINING_SUB_TAB_COUNTS: Record<TrainingsAndSessionsSubTabId, number> = {
  courses: MOCK_COURSES.length,
  'group-trainings': MOCK_GROUP_TRAININGS.length,
  drills: MOCK_DRILLS.length,
  calendar: MOCK_ONE_ON_ONES_PLANNED.length + MOCK_ONE_ON_ONES_PAST.length,
  tests: MOCK_TESTS.length,
  assignments: MOCK_ASSIGNMENTS.length,
  materials: MOCK_MATERIALS.length,
}
