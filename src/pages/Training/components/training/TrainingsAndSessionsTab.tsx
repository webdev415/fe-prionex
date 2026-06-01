import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { TRAININGS_AND_SESSIONS_SUB_TABS, type TrainingsAndSessionsSubTabId } from '../../types'
import { CoursesCatalogTab } from './CoursesCatalogTab'
import { AssignmentsGridTab } from './AssignmentsGridTab'
import { MaterialsLibraryTab } from './MaterialsLibraryTab'
import { GroupTrainingsTab } from './GroupTrainingsTab'
import { DrillsTab } from './DrillsTab'
import { OneOnOneCalendarTab } from './OneOnOneCalendarTab'
import { TestsTab } from './TestsTab'

/**
 * Trainings and Sessions top-tab orchestrator. Hosts the 7 Figma sub-tabs
 * (Courses / Group Trainings / Drills / Calendar / Tests / Assignments /
 * Materials). Per-plan-§3.4 only Courses + Assignments + Materials have
 * backend in this round; the other four ship on mock data for design
 * completeness ahead of KAN-416.
 */
const SUB_TAB_LABELS: Record<TrainingsAndSessionsSubTabId, { key: string; fallback: string }> = {
  courses: { key: 'pages.training.training.subTabs.courses', fallback: 'Courses' },
  'group-trainings': {
    key: 'pages.training.training.subTabs.groupTrainings',
    fallback: 'Group trainings',
  },
  drills: { key: 'pages.training.training.subTabs.drills', fallback: 'Drills' },
  calendar: { key: 'pages.training.training.subTabs.calendar', fallback: 'Calendar' },
  tests: { key: 'pages.training.training.subTabs.tests', fallback: 'Tests' },
  assignments: {
    key: 'pages.training.training.subTabs.assignments',
    fallback: 'Assignments',
  },
  materials: { key: 'pages.training.training.subTabs.materials', fallback: 'Materials' },
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

  const subTabs = useMemo(() => TRAININGS_AND_SESSIONS_SUB_TABS, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {subTabs.map((sub) => {
          const meta = SUB_TAB_LABELS[sub]
          const isActive = activeSubTab === sub
          return (
            <button
              key={sub}
              type="button"
              onClick={() => setActiveSubTab(sub)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'hover:border-primary-300 border-gray-200 bg-white text-gray-700'
              }`}
            >
              {t(meta.key, meta.fallback)}
            </button>
          )
        })}
      </div>

      {activeSubTab === 'courses' && <CoursesCatalogTab />}
      {activeSubTab === 'group-trainings' && <GroupTrainingsTab />}
      {activeSubTab === 'drills' && <DrillsTab />}
      {activeSubTab === 'calendar' && <OneOnOneCalendarTab />}
      {activeSubTab === 'tests' && <TestsTab />}
      {activeSubTab === 'assignments' && <AssignmentsGridTab />}
      {activeSubTab === 'materials' && <MaterialsLibraryTab />}
    </div>
  )
}

export default TrainingsAndSessionsTab
