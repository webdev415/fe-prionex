import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { TRAININGS_AND_SESSIONS_SUB_TABS, type TrainingsAndSessionsSubTabId } from '../../types'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { AssignmentsGridTab } from './AssignmentsGridTab'
import { CallLibraryTab } from './CallLibraryTab'
import { CoursesCatalogTab } from './CoursesCatalogTab'
import { MaterialsLibraryTab } from './MaterialsLibraryTab'
import { GroupTrainingsTab } from './GroupTrainingsTab'
import { DrillsTab } from './DrillsTab'
import { OneOnOneCalendarTab } from './OneOnOneCalendarTab'
import { TestsTab } from './TestsTab'
import { TRAINING_SUB_TAB_COUNTS } from './trainingSubTabCounts'

const SUB_TAB_LABELS: Record<TrainingsAndSessionsSubTabId, { key: string; fallback: string }> = {
  courses: { key: 'pages.training.training.subTabs.courses', fallback: 'Courses' },
  assignments: { key: 'pages.training.training.subTabs.assignments', fallback: 'Assignments' },
  'group-trainings': {
    key: 'pages.training.training.subTabs.groupTrainings',
    fallback: 'Group Training Sessions',
  },
  drills: { key: 'pages.training.training.subTabs.drills', fallback: 'Drill Exercises' },
  calendar: { key: 'pages.training.training.subTabs.calendar', fallback: '1-on-1 Sessions' },
  tests: { key: 'pages.training.training.subTabs.tests', fallback: 'Tests' },
  materials: { key: 'pages.training.training.subTabs.materials', fallback: 'Materials' },
  'call-library': {
    key: 'pages.training.training.subTabs.callLibrary',
    fallback: 'Call library',
  },
}

function isSubTab(value: string | null): value is TrainingsAndSessionsSubTabId {
  return value !== null && (TRAININGS_AND_SESSIONS_SUB_TABS as string[]).includes(value)
}

export function TrainingsAndSessionsTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const rawSub = searchParams.get('sub')
  const activeSubTab: TrainingsAndSessionsSubTabId = isSubTab(rawSub) ? rawSub : 'courses'

  const setActiveSubTab = (sub: TrainingsAndSessionsSubTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'trainings-and-sessions')
    next.set('sub', sub)
    setSearchParams(next, { replace: true })
  }

  const subTabs = useMemo(
    () =>
      TRAININGS_AND_SESSIONS_SUB_TABS.map((sub) => {
        const meta = SUB_TAB_LABELS[sub]
        return {
          id: sub,
          label: t(meta.key, meta.fallback),
          count: TRAINING_SUB_TAB_COUNTS[sub],
        }
      }),
    [t]
  )

  return (
    <div className="flex flex-col gap-4">
      <TrainingSegmentedStrip
        items={subTabs}
        activeId={activeSubTab}
        onChange={(id) => setActiveSubTab(id as TrainingsAndSessionsSubTabId)}
      />

      {activeSubTab === 'courses' && <CoursesCatalogTab />}
      {activeSubTab === 'assignments' && <AssignmentsGridTab />}
      {activeSubTab === 'group-trainings' && <GroupTrainingsTab />}
      {activeSubTab === 'drills' && <DrillsTab />}
      {activeSubTab === 'calendar' && <OneOnOneCalendarTab />}
      {activeSubTab === 'tests' && <TestsTab />}
      {activeSubTab === 'materials' && <MaterialsLibraryTab />}
      {activeSubTab === 'call-library' && <CallLibraryTab />}
    </div>
  )
}

export default TrainingsAndSessionsTab
