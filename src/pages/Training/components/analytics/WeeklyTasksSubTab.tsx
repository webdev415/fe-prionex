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
} from '../../mocks/trainerWorkplaceMocks'
import { PeriodFilterStrip, type PeriodOption } from './PeriodFilterStrip'
import { AnalyticsMockTable } from './AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from './analyticsTableStyles'

/**
 * Weekly Tasks sub-tab under Action Analysis (KAN-415). Renders a per-day
 * KPI strip + the task list filtered to the current week. Heatmap row
 * (week Ã— day) ships in a later step — this boilerplate uses the KPI strip
 * to communicate the day breakdown.
 */
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  const [period, setPeriod] = useState<PeriodOption>('today')
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const k = MOCK_WEEKLY_TASKS_KPIS

  const dayValues = [k.monday, k.tuesday, k.wednesday, k.thursday, k.friday, k.saturday]
  const filteredTasks = MOCK_TASKS.filter(
    (task) => statusFilter === 'all' || task.status === statusFilter
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Per-week KPI strip */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-0.5 border-r border-gray-100 pr-4">
          <span className="text-[10px] text-gray-500 uppercase">
            {t('pages.training.weeklyTasks.kpi.week', 'The week')}
          </span>
          <span className="text-dark-500 text-xl font-semibold">{k.weekTotal}</span>
        </div>
        {DAY_LABELS.map((d, idx) => (
          <div key={d} className="flex flex-col items-center gap-0.5 px-2">
            <span className="text-[10px] text-gray-500 uppercase">{d}</span>
            <span
              className={`text-sm font-semibold ${
                dayValues[idx] === 0 ? 'text-gray-300' : 'text-dark-500'
              }`}
            >
              {dayValues[idx]}
            </span>
          </div>
        ))}
      </div>

      {/* Weekly overdue banner */}
      <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-red-700">
          <Icons.Warning size={14} />
          {t('pages.training.weeklyTasks.overdueBanner', 'Weekly tasks — share an overdue view')}
        </div>
        <Button variant="ghost" size="sm" className="rounded-full text-[11px] text-red-700">
          {t('pages.training.tasks.overdueBannerCta', 'View overdue')}
        </Button>
      </div>

      <PeriodFilterStrip
        value={period}
        onChange={setPeriod}
        extraChips={(['all', 'open', 'in_progress', 'overdue', 'completed'] as const).map((s) => ({
          id: s,
          label: s === 'all' ? 'All tasks' : STATUS_LABEL[s],
          active: statusFilter === s,
          onClick: () => setStatusFilter(s),
        }))}
      />

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
