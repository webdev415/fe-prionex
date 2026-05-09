import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CallMonitoringPeriod } from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type { TAChain } from '@/features/taChains/api/types'
import type { TargetAction } from '@/features/targetActions/api/types'
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
import { TA_HISTORY_FILTERS_DEFAULT, type TaHistoryBarState } from '../lib/taHistoryUrlState'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

interface Props {
  value: TaHistoryBarState
  operators: OperatorUser[]
  chains: TAChain[]
  tasById: Map<number, TargetAction>
  onApply: (next: TaHistoryBarState) => void
  onClear: () => void
  userTimezone?: string | null
}

function parseYmd(dateStr: string | undefined): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function formatYmd(d: Date | null): string | undefined {
  if (!d) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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

export function TaHistoryFiltersBar({
  value,
  operators,
  chains,
  tasById,
  onApply,
  onClear,
  userTimezone,
}: Props) {
  const { t } = useTranslation('common')

  const [draft, setDraft] = useSyncedState<TaHistoryBarState>(value, value)

  const update = (next: Partial<TaHistoryBarState>) => {
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

  const pickedChain = useMemo(
    () => (draft.chainId ? (chains.find((c) => c.id === draft.chainId) ?? null) : null),
    [chains, draft.chainId]
  )
  const chainSteps = useMemo(() => pickedChain?.steps ?? [], [pickedChain])
  const pickedStep = useMemo(
    () =>
      draft.targetActionId != null
        ? (chainSteps.find((s) => s.target_action_id === draft.targetActionId) ?? null)
        : null,
    [chainSteps, draft.targetActionId]
  )
  const pickedTa: TargetAction | null = useMemo(
    () => (pickedStep ? (tasById.get(pickedStep.target_action_id) ?? null) : null),
    [pickedStep, tasById]
  )
  const fieldType = pickedTa?.field_type ?? null

  const parsedStepDateMin = parseYmd(draft.stepValueMin)
  const parsedStepDateMax = parseYmd(draft.stepValueMax)

  const handleApply = () => onApply(draft)
  const handleClearAll = () => {
    setDraft(TA_HISTORY_FILTERS_DEFAULT)
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
          userTimezone={userTimezone}
        />

        <div className="h-px w-full bg-gray-200" />

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4 xl:grid-cols-5">
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
              {t('pages.actionAnalysis.filters.chain', 'Chain')}
            </span>
            <Select
              value={draft.chainId != null ? String(draft.chainId) : 'all'}
              onValueChange={(v) => {
                const next = {
                  targetActionId: undefined,
                  stepValueEq: undefined,
                  stepValueMin: undefined,
                  stepValueMax: undefined,
                }
                if (v === 'all') {
                  update({ chainId: undefined, ...next })
                } else {
                  update({ chainId: Number(v), ...next })
                }
              }}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.actionAnalysis.filters.allChains', 'All chains')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.allChains', 'All chains')}
                </SelectItem>
                {chains.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.chainStep', 'Step')}
            </span>
            <Select
              value={
                draft.chainId != null && draft.targetActionId != null
                  ? String(draft.targetActionId)
                  : 'all'
              }
              onValueChange={(v) => {
                update({
                  targetActionId: v === 'all' ? undefined : Number(v),
                  stepValueEq: undefined,
                  stepValueMin: undefined,
                  stepValueMax: undefined,
                })
              }}
              disabled={draft.chainId == null}
            >
              <SelectTrigger className="h-[45px] w-full">
                <SelectValue
                  placeholder={t('pages.actionAnalysis.filters.allChainSteps', 'All steps')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t('pages.actionAnalysis.filters.allChainSteps', 'All steps')}
                </SelectItem>
                {chainSteps.map((step) => {
                  const label =
                    step.target_action_name ??
                    `${t('pages.actionAnalysis.filters.chainStep', 'Step')} ${step.step_order}`
                  return (
                    <SelectItem key={step.id} value={String(step.target_action_id)}>
                      {step.step_order}. {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {fieldType === 'date' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                  {t('pages.actionAnalysis.filters.stepValueFrom', 'Step value from')}
                </span>
                <DateSelect
                  value={parsedStepDateMin}
                  onChange={({ value }) => update({ stepValueMin: formatYmd(value) ?? undefined })}
                  placeholder={t(
                    'pages.actionAnalysis.filters.selectStartDate',
                    'Select start date'
                  )}
                  max={parsedStepDateMax ?? undefined}
                  format="yyyy-MM-dd"
                  className="[&_input]:h-[45px]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                  {t('pages.actionAnalysis.filters.stepValueTo', 'Step value to')}
                </span>
                <DateSelect
                  value={parsedStepDateMax}
                  onChange={({ value }) => update({ stepValueMax: formatYmd(value) ?? undefined })}
                  placeholder={t('pages.actionAnalysis.filters.selectEndDate', 'Select end date')}
                  min={parsedStepDateMin ?? undefined}
                  format="yyyy-MM-dd"
                  className="[&_input]:h-[45px]"
                />
              </div>
            </>
          )}

          {fieldType === 'amount' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                  {t('pages.actionAnalysis.filters.stepValueMin', 'Step value min')}
                </span>
                <Input
                  type="number"
                  className="h-[45px]"
                  placeholder="0.00"
                  value={draft.stepValueMin ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    update({ stepValueMin: v === '' ? undefined : v })
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                  {t('pages.actionAnalysis.filters.stepValueMax', 'Step value max')}
                </span>
                <Input
                  type="number"
                  className="h-[45px]"
                  placeholder="0.00"
                  value={draft.stepValueMax ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    update({ stepValueMax: v === '' ? undefined : v })
                  }}
                />
              </div>
            </>
          )}

          {fieldType === 'dropdown' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.actionAnalysis.filters.stepValue', 'Step value')}
              </span>
              <Select
                value={draft.stepValueEq ?? 'all'}
                onValueChange={(v) => update({ stepValueEq: v === 'all' ? undefined : v })}
              >
                <SelectTrigger className="h-[45px] w-full">
                  <SelectValue
                    placeholder={t('pages.actionAnalysis.filters.allStepValues', 'All values')}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t('pages.actionAnalysis.filters.allStepValues', 'All values')}
                  </SelectItem>
                  {(pickedTa?.dropdown_values ?? [])
                    .filter((dv) => !dv.is_hidden)
                    .map((dv) => (
                      <SelectItem key={dv.id} value={dv.value}>
                        {dv.value}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(fieldType === 'text' || fieldType === 'credit' || fieldType === 'contact') && (
            <div className="flex flex-col gap-1.5">
              <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.actionAnalysis.filters.stepValue', 'Step value')}
              </span>
              <Input
                type="text"
                className="h-[45px]"
                placeholder={t('pages.actionAnalysis.filters.stepValuePlaceholder', 'Search…')}
                value={draft.stepValueEq ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  update({ stepValueEq: v === '' ? undefined : v })
                }}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.notesSearch', 'Notes search')}
            </span>
            <Input
              type="text"
              className="h-[45px]"
              placeholder={t(
                'pages.actionAnalysis.filters.notesSearchPlaceholder',
                'Search in notes…'
              )}
              value={draft.notesSearch ?? ''}
              onChange={(e) => {
                const v = e.target.value
                update({ notesSearch: v === '' ? undefined : v })
              }}
            />
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
