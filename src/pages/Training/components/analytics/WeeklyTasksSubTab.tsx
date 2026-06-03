import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
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
 * Tab-2 frame: active "The Week N" Σ tile + day tiles with date/day/today
 * layout and status dots, dismissible overdue banner, status chips, table
 * with stacked date/time, Subject column, and chili-style priority.
 */

const DAY_STATUS_DOT: Record<WeeklyDayStatus, string> = {
  overdue: 'bg-[#EF4444]',
  healthy: 'bg-[#22C55E]',
  none: 'bg-[#D1D5DB]',
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

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/** Chili count per priority — Figma uses 3/2/1 chili icons as intensity indicator. */
const PRIORITY_CHILIS: Record<TaskPriority, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
}

/** Inline chili-pepper SVG (no chili glyph in Icons module). */
function ChiliIcon({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M4.2 13.4c2.6.4 5.4-.6 7-2.6 1.5-1.9 2-4.4 1.5-6.4-.6.4-1.4.5-2 .3-.9-.3-1.5-1-1.6-1.9-.7.6-1.5.9-2.3.9-1 0-1.8-.4-2.4-1-.2 2 .4 4 1.7 5.5-1.4.4-2.6 1.5-3.1 2.9-.4 1.2.2 2.2 1.2 2.3z"
        fill="currentColor"
      />
      <path
        d="M11.9 4.7c.5-.6 1.3-1 2-1 .3 0 .5-.3.4-.6-.1-.3-.4-.4-.6-.3-.7.3-1.5 0-1.9-.6-.2-.3-.5-.3-.7-.1-.2.2-.2.5 0 .7.5.7.6 1.5.3 2.2.1.1.3.1.5-.3z"
        fill="currentColor"
      />
    </svg>
  )
}

export function WeeklyTasksSubTab() {
  const { t } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const k = MOCK_WEEKLY_TASKS_KPIS

  const filteredTasks = MOCK_TASKS.filter(
    (task) => statusFilter === 'all' || task.status === statusFilter
  )

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip — "The Week" active tile + 6 day tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {/* "The Week" — active dark-green tile with Σ icon */}
        <div className="flex items-center gap-3 rounded-xl bg-[#204E4D] px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#BBFB5B] text-base font-semibold text-[#05040D]">
            Σ
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] leading-tight font-medium tracking-wide text-white/70 uppercase">
              {t('pages.training.weeklyTasks.kpi.week', 'The Week')}
            </span>
            <span className="text-xl leading-tight font-semibold text-white">{k.weekTotal}</span>
          </div>
        </div>

        {/* Day tiles */}
        {k.days.map((day) => (
          <div
            key={day.label}
            className="flex items-center justify-between gap-2 rounded-xl border border-[#EBECE8] bg-white px-3 py-2.5 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]"
          >
            <div className="flex min-w-0 flex-col">
              <span className="text-[10px] leading-tight font-medium text-[#676767]">
                {day.dateLabel}
              </span>
              <span className="text-xs leading-tight font-medium text-[#05040D]">
                {day.fullLabel}
              </span>
              {day.isToday ? (
                <span className="text-[10px] leading-tight font-medium text-[#22C55E]">
                  {t('pages.training.weeklyTasks.today', 'today')}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span
                className={`text-xl leading-none font-semibold ${
                  day.count === 0 ? 'text-[#A1A1A1]' : 'text-[#05040D]'
                }`}
              >
                {day.count}
              </span>
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${DAY_STATUS_DOT[day.status]}`}
                aria-hidden
              />
            </div>
          </div>
        ))}
      </div>

      {/* Weekly overdue banner — dismissible */}
      {!bannerDismissed ? (
        <div className="flex items-center justify-between rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-[#B91C1C]">
            <Icons.Warning size={14} />
            {t('pages.training.weeklyTasks.overdueBanner', 'Weekly tasks – there are overdue ones')}
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#B91C1C] hover:bg-[#FEE2E2]"
            aria-label={t('common.dismiss', 'Dismiss')}
          >
            <Icons.Close size={12} />
          </button>
        </div>
      ) : null}

      {/* Status filter chips */}
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
              {t('pages.training.weeklyTasks.cols.dateTime', 'Date/Time')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.weeklyTasks.cols.subject', 'Subject')}
            </th>
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
  const chiliCount = PRIORITY_CHILIS[task.priority]
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-[#05040D]">{task.dateLabel}</span>
          {task.timeLabel ? (
            <span className="text-[11px] text-[#676767]">{task.timeLabel}</span>
          ) : null}
        </div>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} font-medium text-[#05040D]`}>{task.title}</td>
      <td className={ANALYTICS_TABLE_TD}>{task.executor}</td>
      <td className={ANALYTICS_TABLE_TD}>{task.author}</td>
      <td className={ANALYTICS_TABLE_TD}>
        {chiliCount > 0 ? (
          <span
            className="inline-flex items-center gap-0.5 text-[#EF4444]"
            title={PRIORITY_LABEL[task.priority]}
            aria-label={PRIORITY_LABEL[task.priority]}
          >
            {Array.from({ length: chiliCount }).map((_, i) => (
              <ChiliIcon key={i} size={14} />
            ))}
          </span>
        ) : (
          <span className="text-[11px] text-[#9CA3AF]">{PRIORITY_LABEL[task.priority]}</span>
        )}
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
