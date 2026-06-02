import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { TASKS_SUB_TABS, type TasksSubTabId } from '../../types'
import {
  MOCK_TASK_KPIS,
  type MockTaskRow,
  type TaskPriority,
  type TaskStatus,
} from '../../mocks/trainerWorkplaceMocks'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { HeaderKpiTile } from '../chrome/HeaderKpiTile'
import { AnalyticsMockTable } from '../analytics/AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from '../analytics/analyticsTableStyles'
import { AnalyticsRadioChips } from '../analytics/AnalyticsRadioChips'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { TrainingPrimaryButton } from '../training/TrainingToolbar'
import { TASKS_SUB_TAB_COUNTS, filterTasksBySubTab } from './tasksSubTabCounts'

const SUB_TAB_LABELS: Record<TasksSubTabId, { key: string; fallback: string }> = {
  'assigned-by-me': {
    key: 'pages.training.tasks.subTabs.assignedByMe',
    fallback: 'Assigned by me',
  },
  'assigned-to-scope': {
    key: 'pages.training.tasks.subTabs.assignedToScope',
    fallback: 'Assigned to scope',
  },
  overdue: { key: 'pages.training.tasks.subTabs.overdue', fallback: 'Overdue' },
  completed: { key: 'pages.training.tasks.subTabs.completed', fallback: 'Completed' },
}

const STATUS_TONE: Record<TaskStatus, string> = {
  open: 'bg-[#FFFBEB] text-[#D97706]',
  in_progress: 'bg-[#EFF6FF] text-[#2563EB]',
  overdue: 'bg-[#FEF2F2] text-[#B91C1C]',
  completed: 'bg-[#F0FDF4] text-[#15803D]',
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

function isSubTab(value: string | null): value is TasksSubTabId {
  return value !== null && (TASKS_SUB_TABS as string[]).includes(value)
}

export function TasksTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)

  const rawSub = searchParams.get('sub')
  const activeSubTab: TasksSubTabId = isSubTab(rawSub) ? rawSub : 'assigned-by-me'

  const setActiveSubTab = (sub: TasksSubTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'tasks')
    next.set('sub', sub)
    setSearchParams(next, { replace: true })
    if (sub === 'overdue') setStatusFilter('all')
  }

  const subTabs = useMemo(
    () =>
      TASKS_SUB_TABS.map((sub) => {
        const meta = SUB_TAB_LABELS[sub]
        return {
          id: sub,
          label: t(meta.key, meta.fallback),
          count: TASKS_SUB_TAB_COUNTS[sub],
        }
      }),
    [t]
  )

  const kpi = MOCK_TASK_KPIS

  const filtered = useMemo(() => {
    const base = filterTasksBySubTab(activeSubTab)
    if (statusFilter === 'all') return base
    return base.filter((task) => task.status === statusFilter)
  }, [activeSubTab, statusFilter])

  const statusChips = useMemo(
    () =>
      (['all', 'open', 'in_progress', 'overdue', 'completed'] as const).map((s) => ({
        id: s,
        label: s === 'all' ? t('pages.training.tasks.chips.all', 'All statuses') : STATUS_LABEL[s],
        active: statusFilter === s,
        onClick: () => setStatusFilter(s),
      })),
    [statusFilter, t]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TrainingSegmentedStrip
          items={subTabs}
          activeId={activeSubTab}
          onChange={(id) => setActiveSubTab(id as TasksSubTabId)}
        />
        <TrainingPrimaryButton
          onClick={() => setCreateOpen(true)}
          leftIcon={<Icons.Add size={14} className="text-white" />}
        >
          {t('pages.training.tasks.create', 'Create task')}
        </TrainingPrimaryButton>
      </div>

      <div className="flex flex-wrap gap-3">
        <HeaderKpiTile
          label={t('pages.training.tasks.kpis.total', 'Total tasks')}
          value={String(kpi.total)}
          icon={Icons.CheckmarkSquare03}
          iconColor="text-[#204E4D]"
          iconBg="bg-white"
          accentColor="#204E4D"
        />
        <HeaderKpiTile
          label={t('pages.training.tasks.kpis.open', 'Open')}
          value={String(kpi.open)}
          icon={Icons.Clock01}
          iconColor="text-[#D97706]"
          iconBg="bg-white"
          accentColor="#D97706"
        />
        <HeaderKpiTile
          label={t('pages.training.tasks.kpis.inProgress', 'In progress')}
          value={String(kpi.inProgress)}
          icon={Icons.Activity01}
          iconColor="text-[#2563EB]"
          iconBg="bg-white"
          accentColor="#2563EB"
        />
        <HeaderKpiTile
          label={t('pages.training.tasks.kpis.overdue', 'Overdue')}
          value={String(kpi.overdue)}
          icon={Icons.Warning}
          iconColor="text-[#EF4444]"
          iconBg="bg-white"
          accentColor="#EF4444"
        />
      </div>

      {kpi.overdue > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FEE2E2] text-[#B91C1C]">
              <Icons.Warning size={14} />
            </span>
            <span className="text-xs font-medium text-[#B91C1C]">
              {t('pages.training.tasks.overdueBanner', 'Weekly tasks — share an overdue view')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveSubTab('overdue')}
            className="inline-flex items-center gap-1 rounded-md border border-[#FECACA] bg-white px-3 py-1.5 text-[11px] font-medium text-[#B91C1C] hover:bg-[#FFF5F5]"
          >
            <Icons.View size={12} />
            {t('pages.training.tasks.overdueBannerCta', 'View overdue')}
          </button>
        </div>
      ) : null}

      <div className="rounded-lg border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-[#05040D]">
            {t('pages.training.interactions.status.label', 'Status')}
          </span>
          <AnalyticsRadioChips items={statusChips} />
        </div>
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
              {t('pages.training.tasks.cols.deadline', 'Deadline')}
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
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </tbody>
      </AnalyticsMockTable>

      <PendingFeatureDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleKey="pages.training.tasks.create"
        titleFallback="Create task"
        descriptionKey="pages.training.tasks.pending.create"
        descriptionFallback="Assign a correction or coaching task to an operator with a deadline."
        dependsOnIssue="KAN-411"
      />
    </div>
  )
}

function TaskRow({ task }: { task: MockTaskRow }) {
  const priorityTone = PRIORITY_TONE[task.priority]
  const statusTone = STATUS_TONE[task.status]
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>{task.dateLabel}</td>
      <td className={`${ANALYTICS_TABLE_TD} font-medium text-[#05040D]`}>{task.title}</td>
      <td className={ANALYTICS_TABLE_TD}>{task.executor}</td>
      <td className={ANALYTICS_TABLE_TD}>{task.author}</td>
      <td className={ANALYTICS_TABLE_TD}>{task.deadlineLabel ?? '—'}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className={`inline-flex items-center gap-1.5 ${priorityTone.text}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${priorityTone.dot}`} />
          <span className="text-[11px] font-medium">{PRIORITY_LABEL[task.priority]}</span>
        </span>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone}`}>
          {STATUS_LABEL[task.status]}
        </span>
      </td>
    </tr>
  )
}

export default TasksTab
