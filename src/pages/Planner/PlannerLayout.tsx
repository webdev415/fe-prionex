/**
 * Frame of the «Планування» section (planner story 1.9).
 *
 * - Shown only when `GET /meta` says `available: true`; anything else renders
 *   «Планер тимчасово недоступний. Решта CRM працює» in place (AC4). The route
 *   itself sits behind `PermissionRoute` with `planner.access` (AC3).
 * - First-level tabs are only «Задачі» and «Календар» (`SegmentedTabs`,
 *   `underline`); inside «Задачі» — `Мої задачі · Дошка ▾` (AC2).
 * - `prep` mode: a permanent info banner for those who see the section (U-40).
 * - `?task=KEY` opens the task panel on any screen of the section (1.10).
 */
import { useTranslation } from 'react-i18next'
import { matchPath, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SegmentedTabs, segmentedTabId, segmentedTabPanelId } from '@/components/ui/SegmentedTabs'
import { usePlannerSection } from '@/api/planner/plannerQueries'
import { PlannerGateMessage } from './components/PlannerGateMessage'
import { TasksNav } from './components/TasksNav'
import { TaskPanel } from './components/TaskPanel'
import { PlannerBanners, type PlannerBanner } from './components/PlannerStates'
import { PLANNER_CALENDAR_PATH, PLANNER_TASKS_PATH } from './plannerFormat'
import { usePlannerTaskParam } from './usePlannerTaskParam'

type PlannerTab = 'tasks' | 'calendar'
const TAB_PREFIX = 'planner'

export function PlannerLayout() {
  const { t } = useTranslation('planner')
  const section = usePlannerSection()
  const location = useLocation()
  const navigate = useNavigate()
  const boardMatch = matchPath(`${PLANNER_TASKS_PATH}/boards/:code`, location.pathname)
  const activeBoard = boardMatch?.params.code ?? null
  const { taskKey, closeTask } = usePlannerTaskParam()

  if (section.kind === 'loading') return <PlannerGateMessage kind="loading" />
  if (section.kind === 'no-access') return <PlannerGateMessage kind="no-access" />
  if (section.kind === 'unavailable') return <PlannerGateMessage kind="unavailable" />

  const tab: PlannerTab = location.pathname.startsWith(PLANNER_CALENDAR_PATH) ? 'calendar' : 'tasks'
  // One banner per reason (5.1); the section's own reasons join this list.
  const banners: PlannerBanner[] =
    section.meta.mode === 'prep' ? [{ reason: 'prep', tone: 'info', text: t('prepBanner') }] : []

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-foreground text-xl font-semibold">{t('section.title')}</h1>

      <PlannerBanners banners={banners} />

      <SegmentedTabs<PlannerTab>
        variant="underline"
        activation="manual"
        idPrefix={TAB_PREFIX}
        ariaLabel={t('tabs.ariaLabel')}
        value={tab}
        onChange={(next) => navigate(next === 'tasks' ? PLANNER_TASKS_PATH : PLANNER_CALENDAR_PATH)}
        items={[
          { id: 'tasks', label: t('tabs.tasks') },
          { id: 'calendar', label: t('tabs.calendar') },
        ]}
      />

      <div
        role="tabpanel"
        id={segmentedTabPanelId(TAB_PREFIX, tab)}
        aria-labelledby={segmentedTabId(TAB_PREFIX, tab)}
        className="space-y-4"
      >
        {tab === 'tasks' && <TasksNav activeBoard={activeBoard} />}
        <Outlet />
      </div>

      {taskKey && <TaskPanel key={taskKey} taskKey={taskKey} onClose={closeTask} />}
    </div>
  )
}

export default PlannerLayout
