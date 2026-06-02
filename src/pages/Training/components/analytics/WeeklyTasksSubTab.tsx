import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import {
  MOCK_TASKS,
  MOCK_WEEKLY_TASKS_KPIS,
  type MockTaskRow,
  type TaskPriority,
  type TaskStatus,
  type WeeklyDayStatus,
} from '../../mocks/trainerWorkplaceMocks'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Weekly Tasks sub-tab under Action Analysis (KAN-415). Mirrors the Figma
 * Tab-2 frame: "The week N" left counter + 6 day tiles with status bar,
 * overdue banner, status filter chips, table.
 */

/** Per-day status indicator bar tone (Figma small underline beneath count). */
const DAY_STATUS_BAR: Record<WeeklyDayStatus, string> = {
  overdue: 'bg-[#EF4444]',
  healthy: 'bg-[#22C55E]',
  none: 'bg-[#EDEDED]',
}

const STATUS_TONE: Record<TaskStatus, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  overdue: 'Overdue',
  completed: 'Completed',
}

const PRIORITY_TONE: Record<TaskPriority, { dot: string; text: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-600' },
  high: { dot: 'bg-amber-500', text: 'text-amber-600' },
  medium: { dot: 'bg-blue-500', text: 'text-blue-600' },
  low: { dot: 'bg-gray-400', text: 'text-gray-600' },
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function WeeklyTasksSubTab() {
  const { t } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const k = MOCK_WEEKLY_TASKS_KPIS

  const filteredTasks = MOCK_TASKS.filter(
    (task) => statusFilter === 'all' || task.status === statusFilter
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Per-week KPI strip — separate tiles per day, matches the KPI-tile
          pattern used by other Action Analysis sub-tabs (Promises / Closures
          / Time at Work). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {/* "The week" total tile */}
        <div className="flex flex-col gap-1 rounded-xl border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
          <span className="text-[10px] font-medium tracking-wide text-[#676767] uppercase">
            {t('pages.training.weeklyTasks.kpi.week', 'The week')}
          </span>
          <span className="text-2xl font-semibold text-[#05040D]">{k.weekTotal}</span>
          <span className={`h-1 w-8 rounded-full ${DAY_STATUS_BAR.overdue}`} aria-hidden />
        </div>

        {/* Day tiles */}
        {k.days.map((day) => (
          <div
            key={day.label}
            className="flex flex-col gap-1 rounded-xl border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]"
          >
            <span className="text-[10px] font-medium tracking-wide text-[#676767] uppercase">
              {day.label}
            </span>
            <span
              className={`text-2xl font-semibold ${
                day.count === 0 ? 'text-[#A1A1A1]' : 'text-[#05040D]'
              }`}
            >
              {day.count}
            </span>
            <span className={`h-1 w-8 rounded-full ${DAY_STATUS_BAR[day.status]}`} aria-hidden />
          </div>
        ))}
      </div>

      {/* Weekly overdue banner */}
      <div className="flex items-center justify-between rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-[#B91C1C]">
          <Icons.Warning size={14} />
          {t('pages.training.weeklyTasks.overdueBanner', 'Weekly tasks — share an overdue view')}
        </div>
        <Button variant="ghost" size="sm" className="rounded-full text-[11px] text-[#B91C1C]">
          {t('pages.training.tasks.overdueBannerCta', 'View overdue')}
        </Button>
      </div>

      {/* Status filter chips — Figma Tab 2 shows status pills only (no period selector) */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'open', 'in_progress', 'overdue', 'completed'] as const).map((s) => {
          const isActive = statusFilter === s
          const label = s === 'all' ? 'All tasks' : STATUS_LABEL[s]
          const count =
            s === 'all' ? MOCK_TASKS.length : MOCK_TASKS.filter((task) => task.status === s).length
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                isActive ? 'bg-[#204E4D] text-white' : 'bg-white text-[#05040D] hover:bg-gray-50'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#05040D]'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.tasks.cols.date', 'Date/Time')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>{t('pages.training.tasks.cols.task', 'Task')}</th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.tasks.cols.executor', 'Executor')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.tasks.cols.author', 'Author')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.tasks.cols.priority', 'Priority')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.tasks.cols.status', 'Status')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </tbody>
      </AnalyticsMockTable>
    </div>
  )
}

function TaskRow({ task }: { task: MockTaskRow }) {
  const priority = PRIORITY_TONE[task.priority]
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>{task.dateLabel}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-medium text-[#05040D]`}>{task.title}</td>
      <td className={ANALYTICS_TABLE_TD}>{task.executor}</td>
      <td className={ANALYTICS_TABLE_TD}>{task.author}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className={`inline-flex items-center gap-1.5 ${priority.text}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${priority.dot}`} />
          <span className="text-[11px] font-medium">{PRIORITY_LABEL[task.priority]}</span>
        </span>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[task.status]}`}
        >
          {STATUS_LABEL[task.status]}
        </span>
      </td>
    </tr>
  )
}

export default WeeklyTasksSubTab
