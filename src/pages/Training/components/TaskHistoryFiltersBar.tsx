import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CallMonitoringPeriod,
  TaskPriority,
  TaskStatus,
  TaskSubject,
} from '@/features/training'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Input } from '@/components/ui/Input'
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
import type { ScopedUserIds } from '../lib/scope'
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

interface Props {
  value: TaskHistoryBarState
  operators: OperatorUser[]
  subjects: TaskSubject[]
  onApply: (next: TaskHistoryBarState) => void
  onClear: () => void
  userTimezone?: string | null
  /** Page-level scope (KAN-506) — drives the picker-disabled flags. Optional
   *  so the bar still renders standalone for tests / future surfaces. */
  scope?: ScopedUserIds
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

function ymdToDate(ymd: string | undefined): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function dateToYmd(d: Date | null): string | undefined {
  if (!d) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function TaskHistoryFiltersBar({
  value,
  operators,
  subjects,
  onApply,
  onClear,
  userTimezone,
  scope,
}: Props) {
  const { t } = useTranslation('common')

  const scopeLockedDeptLabel = scope?.departmentPickerDisabled
    ? t(scope.disabledLabelKey, 'Scoped')
    : undefined
  const scopeLockedEmpLabel = scope?.employeePickerDisabled
    ? t(scope.disabledLabelKey, 'Scoped')
    : undefined

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

  const dueFrom = ymdToDate(draft.dueFromDate)
  const dueTo = ymdToDate(draft.dueToDate)

  return (
    <div className={FILTER_SURFACE}>
      <div className="flex w-full flex-col gap-4 sm:gap-6">
        <DateRangeQuickFilter
          period={period}
          customFromDate={draft.customFromDate}
          customToDate={draft.customToDate}
          onChange={(next) => update(next)}
          userTimezone={userTimezone}
        />

        <div className="h-px w-full bg-gray-200" />

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.department', 'Department')}
            </span>
            <Select
              value={departmentSelectValue}
              disabled={scope?.departmentPickerDisabled}
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
                  placeholder={
                    scopeLockedDeptLabel ??
                    t('pages.training.filters.allDepartments', 'All departments')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.allDepartments', 'All departments')}
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
            disabled={draft.departmentId != null || scope?.employeePickerDisabled}
            disabledLabel={scopeLockedEmpLabel ?? departmentName}
            label={t('pages.training.filters.assignee', 'Assignee')}
          />

          <EmployeeFilterDropdown
            operators={operators}
            selectedIds={draft.authorIds}
            onChange={(ids) => update({ authorIds: ids })}
            label={t('pages.training.filters.author', 'Author')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.group', 'Group')}
            </span>
            <Select value="all" disabled>
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.training.filters.groupComingSoon', 'Coming soon')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.groupComingSoon', 'Coming soon')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.topic', 'Topic')}
            </span>
            <Select
              value={draft.subjectId != null ? String(draft.subjectId) : 'all'}
              onValueChange={(v) => update({ subjectId: v === 'all' ? undefined : Number(v) })}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue placeholder={t('pages.training.filters.allTopics', 'All topics')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.allTopics', 'All topics')}
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
              {t('pages.training.filters.priority', 'Priority')}
            </span>
            <Select
              value={draft.priority ?? 'all'}
              onValueChange={(v) =>
                update({ priority: v === 'all' ? undefined : (v as TaskPriority) })
              }
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue placeholder={t('pages.training.filters.priorities.all', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.priorities.all', 'All')}
                </SelectItem>
                {PRIORITY_VALUES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`pages.training.filters.priorities.${p}`, p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.training.filters.status', 'Status')}
            </span>
            <Select
              value={draft.status ?? 'all'}
              onValueChange={(v) => update({ status: v === 'all' ? undefined : (v as TaskStatus) })}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue placeholder={t('pages.training.filters.statuses.all', 'All')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.training.filters.statuses.all', 'All')}
                </SelectItem>
                {STATUS_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`pages.training.filters.statuses.${s}`, s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Due-date / Due-time filters live after Status. The two visible
            filters compose into one due_date_from / due_date_to window. */}
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white/60 p-4">
          <span className="text-dark-500 text-xs font-semibold tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
            {t('pages.training.filters.dueRangeHeading', 'Due date / time')}
          </span>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                {t('pages.training.filters.dueDateFrom', 'Due date from')}
              </span>
              <DateSelect
                value={dueFrom}
                onChange={({ value: v }) => update({ dueFromDate: dateToYmd(v) ?? undefined })}
                placeholder={t('pages.training.filters.selectStartDate', 'Select start date')}
                max={dueTo ?? undefined}
                allowManualInput
                format="dd.MM.yyyy"
                className="min-w-0 flex-1 [&_input]:h-[45px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                {t('pages.training.filters.dueTimeFrom', 'Due time from')}
              </span>
              <Input
                type="time"
                className="h-[45px]"
                value={draft.dueFromTime ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  update({ dueFromTime: v === '' ? undefined : v })
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                {t('pages.training.filters.dueDateTo', 'Due date to')}
              </span>
              <DateSelect
                value={dueTo}
                onChange={({ value: v }) => update({ dueToDate: dateToYmd(v) ?? undefined })}
                placeholder={t('pages.training.filters.selectEndDate', 'Select end date')}
                min={dueFrom ?? undefined}
                allowManualInput
                format="dd.MM.yyyy"
                className="min-w-0 flex-1 [&_input]:h-[45px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-600">
                {t('pages.training.filters.dueTimeTo', 'Due time to')}
              </span>
              <Input
                type="time"
                className="h-[45px]"
                value={draft.dueToTime ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  update({ dueToTime: v === '' ? undefined : v })
                }}
              />
            </div>
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
            {t('pages.training.filters.clearAll', 'Clear All')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleApply}
            className="h-[45px] w-full rounded sm:w-auto sm:px-8"
          >
            {t('pages.training.filters.applyFilters', 'Apply Filters')}
          </Button>
        </div>
      </div>
    </div>
  )
}
