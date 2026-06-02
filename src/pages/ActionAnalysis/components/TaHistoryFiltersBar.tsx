import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CallMonitoringPeriod } from '@/features/actionAnalysis'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type { TAChain } from '@/features/taChains/api/types'
import type { TargetAction } from '@/features/targetActions/api/types'
import { Button } from '@/components/ui/Button'
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
import {
  TA_HISTORY_FILTERS_DEFAULT,
  type StepValueEntry,
  type TaHistoryBarState,
} from '../lib/taHistoryUrlState'
import type { ScopedUserIds } from '../lib/scope'
import { DateRangeQuickFilter } from './DateRangeQuickFilter'
import { EmployeeFilterDropdown } from './EmployeeFilterDropdown'
import { StepFilterDropdown } from './StepFilterDropdown'
import { StepValueRow } from './StepValueRow'

const FILTER_SURFACE = 'rounded-xl bg-white/50 p-4 shadow-sm sm:p-6'

interface Props {
  value: TaHistoryBarState
  operators: OperatorUser[]
  chains: TAChain[]
  tasById: Map<number, TargetAction>
  onApply: (next: TaHistoryBarState) => void
  onClear: () => void
  userTimezone?: string | null
  /** Page-level scope (KAN-506) — drives the picker-disabled flags. */
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

export function TaHistoryFiltersBar({
  value,
  operators,
  chains,
  tasById,
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

  // Selected steps in chain order, with the resolved TA for each so the
  // per-step value inputs know their field_type and dropdown options.
  const selectedStepRows = useMemo(() => {
    const picked = new Set(draft.targetActionIds)
    return [...chainSteps]
      .filter((s) => picked.has(s.target_action_id))
      .sort((a, b) => a.step_order - b.step_order)
      .map((s) => ({
        step: s,
        ta: tasById.get(s.target_action_id) ?? null,
      }))
  }, [chainSteps, draft.targetActionIds, tasById])

  const setStepValue = (taId: number, patch: Partial<StepValueEntry>) => {
    setDraft((prev) => {
      const prevEntry = prev.stepValues[taId] ?? {}
      const merged: StepValueEntry = { ...prevEntry, ...patch }
      // Strip empty keys so the URL stays clean.
      const clean: StepValueEntry = {}
      if (merged.eq) clean.eq = merged.eq
      if (merged.min) clean.min = merged.min
      if (merged.max) clean.max = merged.max
      const nextValues = { ...prev.stepValues }
      if (clean.eq || clean.min || clean.max) {
        nextValues[taId] = clean
      } else {
        delete nextValues[taId]
      }
      return { ...prev, stepValues: nextValues }
    })
  }

  const onStepSelectionChange = (ids: number[]) => {
    // Drop stepValues entries for steps that are no longer selected.
    const picked = new Set(ids)
    const nextValues: Record<number, StepValueEntry> = {}
    for (const [k, v] of Object.entries(draft.stepValues)) {
      const id = Number(k)
      if (picked.has(id)) nextValues[id] = v
    }
    update({ targetActionIds: ids, stepValues: nextValues })
  }

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
                    t('pages.actionAnalysis.filters.allDepartments', 'All departments')
                  }
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
            disabled={draft.departmentId != null || scope?.employeePickerDisabled}
            disabledLabel={scopeLockedEmpLabel ?? departmentName}
            label={t('pages.actionAnalysis.filters.employee', 'Employee')}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-dark-500 text-xs font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.chain', 'Chain')}
            </span>
            <Select
              value={draft.chainId != null ? String(draft.chainId) : 'all'}
              onValueChange={(v) => {
                if (v === 'all') {
                  update({ chainId: undefined, targetActionIds: [], stepValues: {} })
                } else {
                  update({ chainId: Number(v), targetActionIds: [], stepValues: {} })
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

          <StepFilterDropdown
            steps={chainSteps}
            selectedIds={draft.targetActionIds}
            onChange={onStepSelectionChange}
            disabled={draft.chainId == null}
            label={t('pages.actionAnalysis.filters.chainStep', 'Step')}
          />

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

        {selectedStepRows.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white/60 p-4">
            <span className="text-dark-500 text-xs font-semibold tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
              {t('pages.actionAnalysis.filters.stepValuesHeading', 'Step value filters')}
            </span>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
              {selectedStepRows.map(({ step, ta }) => (
                <StepValueRow
                  key={step.id}
                  step={step}
                  ta={ta}
                  value={draft.stepValues[step.target_action_id] ?? {}}
                  onChange={(patch) => setStepValue(step.target_action_id, patch)}
                />
              ))}
            </div>
          </div>
        )}

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
