import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import {
  MOCK_TASKS,
  MOCK_TASK_KPIS,
  type MockTaskRow,
  type TaskPriority,
  type TaskStatus,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * Tasks top-tab (KAN-411 revised). Filter chips strip + Tasks table with
 * priority + status badges. The "Weekly tasks — share an overdue view"
 * banner mirrors the Figma frame.
 */
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

export function TasksTab() {
  const { t } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')

  const kpi = MOCK_TASK_KPIS
  const filtered = MOCK_TASKS.filter(
    (task) => statusFilter === 'all' || task.status === statusFilter
  )

  const chips: { id: TaskStatus | 'all'; label: string; count: number; tone: string }[] = [
    {
      id: 'all',
      label: t('pages.training.tasks.chips.all', 'All tasks'),
      count: kpi.total,
      tone: 'bg-primary-50 text-primary-700',
    },
    {
      id: 'open',
      label: t('pages.training.tasks.chips.open', 'Open'),
      count: kpi.open,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      id: 'in_progress',
      label: t('pages.training.tasks.chips.inProgress', 'In progress'),
      count: kpi.inProgress,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      id: 'overdue',
      label: t('pages.training.tasks.chips.overdue', 'Overdue'),
      count: kpi.overdue,
      tone: 'bg-red-50 text-red-700',
    },
    {
      id: 'completed',
      label: t('pages.training.tasks.chips.completed', 'Completed'),
      count: kpi.completed,
      tone: 'bg-emerald-50 text-emerald-700',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Overdue-week banner (mirrors the Figma frame) */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-600">
            <Icons.Warning size={14} />
          </span>
          <span className="text-xs font-medium text-red-700">
            {t('pages.training.tasks.overdueBanner', 'Weekly tasks — share an overdue view')}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-[11px] text-red-700"
          leftIcon={<Icons.View size={12} className="text-red-700" />}
        >
          {t('pages.training.tasks.overdueBannerCta', 'View overdue')}
        </Button>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const isActive = chip.id === statusFilter
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStatusFilter(chip.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {chip.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                  isActive ? 'bg-white/20 text-white' : chip.tone
                }`}
              >
                {chip.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tasks table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-[10px] text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3">{t('pages.training.tasks.cols.date', 'Date/Time')}</th>
              <th className="px-4 py-3">{t('pages.training.tasks.cols.task', 'Task')}</th>
              <th className="px-4 py-3">{t('pages.training.tasks.cols.executor', 'Executor')}</th>
              <th className="px-4 py-3">{t('pages.training.tasks.cols.author', 'Author')}</th>
              <th className="px-4 py-3">{t('pages.training.tasks.cols.priority', 'Priority')}</th>
              <th className="px-4 py-3">{t('pages.training.tasks.cols.status', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: MockTaskRow }) {
  const priorityTone = PRIORITY_TONE[task.priority]
  const statusTone = STATUS_TONE[task.status]
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-600">{task.dateLabel}</td>
      <td className="text-dark-500 px-4 py-3 font-medium">{task.title}</td>
      <td className="px-4 py-3 text-gray-700">{task.executor}</td>
      <td className="px-4 py-3 text-gray-600">{task.author}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 ${priorityTone.text}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${priorityTone.dot}`} />
          <span className="text-[11px] font-medium">{PRIORITY_LABEL[task.priority]}</span>
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone}`}>
          {STATUS_LABEL[task.status]}
        </span>
      </td>
    </tr>
  )
}

export default TasksTab
