import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { TASKS_SUB_TABS, type TasksSubTabId } from '../../types'
import {
  type MockTaskRow,
  type TaskCategory,
  type TaskKanbanColumn,
  type TaskPriority,
} from '../../mocks/trainerWorkplaceMocks'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { TrainingPrimaryButton } from '../training/TrainingToolbar'
import { TASKS_SUB_TAB_COUNTS, filterTasksBySubTab } from './tasksSubTabCounts'

/** Figma Tasks tab — 4 chip filters + green "New task" CTA + 4-column
 *  Kanban board (ДО РОБОТИ / У РОБОТІ / ЗАПЛАНОВАНО / ГОТОВО).
 *
 *  This file owns the layout; per-card visuals live in `TaskKanbanCard`
 *  below.
 */

const SUB_TAB_LABELS: Record<TasksSubTabId, { key: string; fallback: string }> = {
  all: { key: 'pages.training.tasks.chips.all', fallback: 'All' },
  today: { key: 'pages.training.tasks.chips.today', fallback: 'Today' },
  tomorrow: { key: 'pages.training.tasks.chips.tomorrow', fallback: 'Tomorrow' },
  this_week: { key: 'pages.training.tasks.chips.week', fallback: 'Week' },
}

const KANBAN_COLUMNS: { id: TaskKanbanColumn; key: string; fallback: string; dot: string }[] = [
  { id: 'to_do', key: 'pages.training.tasks.kanban.toDo', fallback: 'TO DO', dot: 'bg-[#A1A1A1]' },
  {
    id: 'in_progress',
    key: 'pages.training.tasks.kanban.inProgress',
    fallback: 'IN PROGRESS',
    dot: 'bg-[#3B82F6]',
  },
  {
    id: 'planned',
    key: 'pages.training.tasks.kanban.planned',
    fallback: 'PLANNED',
    dot: 'bg-[#F59E0B]',
  },
  { id: 'done', key: 'pages.training.tasks.kanban.done', fallback: 'DONE', dot: 'bg-[#22C55E]' },
]

const PRIORITY_PILL: Record<TaskPriority, { label: string; tone: string }> = {
  critical: { label: 'Critical', tone: 'bg-[#FEF2F2] text-[#B91C1C]' },
  high: { label: 'High', tone: 'bg-[#FFEDD5] text-[#C2410C]' },
  medium: { label: 'Medium', tone: 'bg-[#FEF9C3] text-[#A16207]' },
  low: { label: 'Low', tone: 'bg-[#F3F4F6] text-[#6B7280]' },
}

const CATEGORY_ICON: Record<
  TaskCategory,
  { icon: (p: { size?: number; className?: string }) => React.ReactNode; bg: string; tone: string }
> = {
  listen: { icon: Icons.Headset, bg: 'bg-[#FEF3C7]', tone: 'text-[#A16207]' },
  assign_drill: { icon: Icons.Brochure, bg: 'bg-[#EDE9FE]', tone: 'text-[#6D28D9]' },
  check_test: { icon: Icons.CheckmarkSquare03, bg: 'bg-[#DBEAFE]', tone: 'text-[#1D4ED8]' },
  checklist: { icon: Icons.Checkmark, bg: 'bg-[#FCE7F3]', tone: 'text-[#BE185D]' },
  prepare: { icon: Icons.File, bg: 'bg-[#FFE4E6]', tone: 'text-[#BE123C]' },
  session: { icon: Icons.Calendar, bg: 'bg-[#D1FAE5]', tone: 'text-[#047857]' },
}

function isSubTab(value: string | null): value is TasksSubTabId {
  return value !== null && (TASKS_SUB_TABS as string[]).includes(value)
}

export function TasksTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)

  const rawSub = searchParams.get('sub')
  const activeSubTab: TasksSubTabId = isSubTab(rawSub) ? rawSub : 'all'

  const setActiveSubTab = (sub: TasksSubTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'tasks')
    next.set('sub', sub)
    setSearchParams(next, { replace: true })
  }

  const filtered = useMemo(() => filterTasksBySubTab(activeSubTab), [activeSubTab])

  const tasksByColumn = useMemo(() => {
    return KANBAN_COLUMNS.reduce<Record<TaskKanbanColumn, MockTaskRow[]>>(
      (acc, col) => {
        acc[col.id] = filtered.filter((task) => (task.kanbanColumn ?? 'to_do') === col.id)
        return acc
      },
      { to_do: [], in_progress: [], planned: [], done: [] }
    )
  }, [filtered])

  return (
    <div className="flex flex-col gap-4">
      {/* Filter chips + New task button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-[#EBECE8] bg-white p-1 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
          {TASKS_SUB_TABS.map((sub) => {
            const meta = SUB_TAB_LABELS[sub]
            const isActive = activeSubTab === sub
            const count = TASKS_SUB_TAB_COUNTS[sub]
            return (
              <button
                key={sub}
                type="button"
                onClick={() => setActiveSubTab(sub)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium tracking-[-0.02em] transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white' : 'text-[#545454] hover:bg-[#F7F7F7]'
                }`}
              >
                {t(meta.key, meta.fallback)}
                <span
                  className={`flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                    isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#05040D]'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        <TrainingPrimaryButton
          onClick={() => setCreateOpen(true)}
          leftIcon={<Icons.Add size={14} className="text-white" />}
        >
          {t('pages.training.tasks.create', 'New task')}
        </TrainingPrimaryButton>
      </div>

      {/* Kanban board — 4 columns */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => {
          const cards = tasksByColumn[col.id]
          return (
            <div key={col.id} className="flex flex-col gap-3 rounded-xl bg-[#F7F7F7]/60 p-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${col.dot}`} />
                  <span className="text-[11px] font-semibold tracking-wide text-[#05040D] uppercase">
                    {t(col.key, col.fallback)}
                  </span>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#05040D]">
                  {cards.length}
                </span>
              </div>

              {cards.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-white text-[11px] text-[#9CA3AF]">
                  {t('pages.training.tasks.kanban.empty', 'Empty')}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {cards.map((task) => (
                    <TaskKanbanCard key={task.id} task={task} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <PendingFeatureDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleKey="pages.training.tasks.create"
        titleFallback="New task"
        descriptionKey="pages.training.tasks.pending.create"
        descriptionFallback="Assign a correction or coaching task to an operator with a deadline."
        dependsOnIssue="KAN-411"
      />
    </div>
  )
}

function TaskKanbanCard({ task }: { task: MockTaskRow }) {
  const cat = task.category ? CATEGORY_ICON[task.category] : CATEGORY_ICON.checklist
  const CatIcon = cat.icon
  const priority = PRIORITY_PILL[task.priority]

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#EBECE8] bg-white p-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md">
      {/* Top row — category icon + title + priority pill */}
      <div className="flex items-start gap-2">
        <span
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md ${cat.bg} ${cat.tone}`}
        >
          <CatIcon size={12} />
        </span>
        <span className="text-dark-500 flex-1 text-xs leading-snug font-semibold text-[#05040D]">
          {task.title}
        </span>
        <span
          className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium ${priority.tone}`}
        >
          {priority.label}
        </span>
      </div>

      {/* Subtitle */}
      {task.subtitle ? (
        <span className="ml-8 text-[11px] text-[#676767]">{task.subtitle}</span>
      ) : null}

      {/* Bottom row — operator + timestamp */}
      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.operatorInitials ? (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-[#05040D]"
              style={{ backgroundColor: task.operatorAvatarColor ?? '#EDEDED' }}
            >
              {task.operatorInitials}
            </span>
          ) : null}
          <span className="text-[11px] font-medium text-[#05040D]">{task.executor}</span>
        </div>
        <span className="text-[10px] text-[#9CA3AF]">{task.cardTimestamp ?? task.dateLabel}</span>
      </div>
    </div>
  )
}

export default TasksTab
