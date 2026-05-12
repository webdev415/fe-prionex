import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CallMonitoringPeriod,
  TaskHistoryDateType,
  TaskPriority,
  TaskStatus,
  TaskSubject,
} from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useSyncedState } from '@/hooks'
import { Icons } from '@/lib/icons'
import { TASK_HISTORY_FILTERS_DEFAULT, type TaskHistoryBarState } from '../lib/taskHistoryUrlState'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

const PRIORITY_VALUES: readonly TaskPriority[] = ['low', 'normal', 'high', 'urgent', 'critical']
const STATUS_VALUES: readonly TaskStatus[] = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'extended',
  'rejected',
  'incoming_line_result',
]
const DATE_TYPE_VALUES: readonly TaskHistoryDateType[] = ['created', 'due']

interface Props {
  value: TaskHistoryBarState
  operators: OperatorUser[]
  subjects: TaskSubject[]
  onApply: (next: TaskHistoryBarState) => void
  onClear: () => void
  userTimezone?: string | null
}

function buildDepartmentOptions(operators: OperatorUser[]) {
  const map = new Map<number, string>()
  for (const o of operators) {
    if (o.department_id != null) {
      const label = o.department_name?.trim() || `ID ${o.department_id}`
      if (!map.has(o.department_id)) map.set(o.department_id, label)
    }
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function TaskHistoryFiltersBar({
  value,
  operators,
  subjects,
  onApply,
  onClear,
  userTimezone: _userTimezone,
}: Props) {
  const { t } = useTranslation('common')

  const [draft, setDraft] = useSyncedState<TaskHistoryBarState>(value, value)

  const update = (next: Partial<TaskHistoryBarState>) => {
    setDraft((prev) => {
      const merged = { ...prev, ...next }
      if (merged.period !== 'custom') {
        merged.customFromDate = undefined
        merged.customToDate = undefined
      }
      return merged
    })
  }

  const period: CallMonitoringPeriod = draft.period ?? 'last_7d'

  const departmentOptions = useMemo(() => buildDepartmentOptions(operators), [operators])
  const departmentSelectValue = draft.departmentId != null ? String(draft.departmentId) : 'all'
  const departmentName =
    draft.departmentId != null
      ? (departmentOptions.find((d) => d.id === draft.departmentId)?.name ?? undefined)
      : undefined

  const handleApply = () => onApply(draft)
  const handleClearAll = () => {
    setDraft(TASK_HISTORY_FILTERS_DEFAULT)
    onClear()
  }

  return (
    <div className={FILTER_SURFACE}>
      <div className="flex w-full flex-col gap-4 sm:gap-6">
        <DateRangeQuickFilter
          period={period}
          customFromDate={draft.customFromDate}
          customToDate={draft.customToDate}
          onChange={(next) => update(next)}
          userTimezone={_userTimezone}
        />

        <div className="h-px w-full bg-gray-200" />

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.taskDateType', 'Date type')}
            </span>
            <Select
              value={draft.dateType}
              onValueChange={(v) => update({ dateType: v as TaskHistoryDateType })}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_TYPE_VALUES.map((dt) => (
                  <SelectItem key={dt} value={dt}>
                    {t(`pages.actionAnalysis.filters.taskDateTypes.${dt}`, dt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.department', 'Department')}
            </span>
            <Select
              value={departmentSelectValue}
              onValueChange={(v) => {
                if (v === 'all') {
                  update({ departmentId: null })
                } else {
                  update({ departmentId: Number(v), employeeIds: [] })
                }
              }}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.actionAnalysis.filters.allDepartments', 'All departments')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.allDepartments', 'All departments')}
                </SelectItem>
                {departmentOptions.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <EmployeeFilterDropdown
            operators={operators}
            selectedIds={draft.employeeIds}
            onChange={(ids) => update({ departmentId: null, employeeIds: ids })}
            disabled={draft.departmentId != null}
            disabledLabel={departmentName}
            label={t('pages.actionAnalysis.filters.employee', 'Employee')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.group', 'Group')}
            </span>
            <Select value="all" disabled>
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.actionAnalysis.filters.groupComingSoon', 'Coming soon')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.groupComingSoon', 'Coming soon')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.topic', 'Topic')}
            </span>
            <Select
              value={draft.subjectId != null ? String(draft.subjectId) : 'all'}
              onValueChange={(v) => update({ subjectId: v === 'all' ? undefined : Number(v) })}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.actionAnalysis.filters.allTopics', 'All topics')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.allTopics', 'All topics')}
                </SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.priority', 'Priority')}
            </span>
            <Select
              value={draft.priority ?? 'all'}
              onValueChange={(v) =>
                update({ priority: v === 'all' ? undefined : (v as TaskPriority) })
              }
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.actionAnalysis.filters.priorities.all', 'All')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.priorities.all', 'All')}
                </SelectItem>
                {PRIORITY_VALUES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`pages.actionAnalysis.filters.priorities.${p}`, p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.status', 'Status')}
            </span>
            <Select
              value={draft.status ?? 'all'}
              onValueChange={(v) => update({ status: v === 'all' ? undefined : (v as TaskStatus) })}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue placeholder={t('pages.actionAnalysis.filters.statuses.all', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.statuses.all', 'All')}
                </SelectItem>
                {STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`pages.actionAnalysis.filters.statuses.${s}`, s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Button
            type="button"
            variant="white-secondary"
            onClick={handleClearAll}
            className="h-[45px] w-full rounded sm:w-auto sm:px-6"
            leftIcon={<Icons.Reload size={16} />}
          >
            {t('pages.actionAnalysis.filters.clearAll', 'Clear All')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleApply}
            className="h-[45px] w-full rounded sm:w-auto sm:px-8"
          >
            {t('pages.actionAnalysis.filters.applyFilters', 'Apply Filters')}
          </Button>
        </div>
      </div>
    </div>
  )
}
