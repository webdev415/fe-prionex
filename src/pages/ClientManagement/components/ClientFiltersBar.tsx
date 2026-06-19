/**
 * Client Filters Bar Component
 *
 * Collapsible filter bar with multiple filter options for client management.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { PortfolioDropdown } from './PortfolioDropdown'
import { TagsDropdown } from './TagsDropdown'
import { LastInteractionResultDropdown } from './LastInteractionResultDropdown'
import {
  NO_INTERACTIONS_ID,
  NO_RESPONSIBLE_ID,
  OperatorMultiSelectDropdown,
} from './OperatorMultiSelectDropdown'
import { useSellers } from '@/features/sellers/hooks/useSellers'
import { useTags } from '@/features/tags/hooks/useTags'
import { useTAChains } from '@/features/taChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import type { TargetAction } from '@/features/targetActions/api/types'
import { ClientStepFilterDropdown } from './ClientStepFilterDropdown'
import { ClientStepValueRow, type StepValueEntry } from './ClientStepValueRow'
import { useOperatorFilterOptions } from '../hooks/useOperatorFilterOptions'
import { useAuthStore } from '@/stores/authStore'
import { formatPickerDateAsYMD } from '@/lib/dateUtils'
import type { ClientFilters } from '../ClientManagementPage'

// Debounced number input component to avoid re-rendering on every keystroke
function DebouncedNumberInput({
  value,
  onChange,
  placeholder,
  className,
  formatWithCommas = false,
  onClear,
}: {
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
  className?: string
  formatWithCommas?: boolean
  onClear?: () => void
}) {
  const [localValue, setLocalValue] = useState(value?.toString() || '')
  const [isFocused, setIsFocused] = useState(false)

  // Update local value when prop changes (only when not focused)
  // The isFocused guard prevents cascading renders - state only updates when input is blurred
  useEffect(() => {
    if (!isFocused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalValue(value?.toString() || '')
    }
  }, [value, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, '') // Remove commas
    setLocalValue(rawValue)
  }

  const handleBlur = () => {
    setIsFocused(false)
    const numValue = localValue ? Number(localValue.replace(/,/g, '')) : undefined
    if (numValue !== value) {
      onChange(numValue)
    }
  }

  const displayValue = isFocused
    ? localValue
    : localValue && formatWithCommas
      ? new Intl.NumberFormat('uk-UA').format(Number(localValue.replace(/,/g, '')))
      : localValue

  // × is opt-in (onClear) and only meaningful when there is a value to clear.
  // Clearing resets local state immediately and routes through the existing
  // onClear handler (which calls the field's normal change handler with empty).
  const handleClear =
    onClear && displayValue
      ? () => {
          setLocalValue('')
          onClear()
        }
      : undefined

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      onClear={handleClear}
    />
  )
}

interface ClientFiltersBarProps {
  filters: ClientFilters
  onFilterChange: (filters: ClientFilters) => void
}

type FilterDateField =
  | 'dateOfSaleFrom'
  | 'dateOfSaleTo'
  | 'taDateFrom'
  | 'taDateTo'
  | 'interactionDateFrom'
  | 'interactionDateTo'
  | 'assignmentDateFrom'
  | 'assignmentDateTo'

export function ClientFiltersBar({ filters, onFilterChange }: ClientFiltersBarProps) {
  const { t } = useTranslation('common')
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(false)
  const [tagsDropdownOpen, setTagsDropdownOpen] = useState(false)
  const [lastInteractionResultDropdownOpen, setLastInteractionResultDropdownOpen] = useState(false)

  // Fetch sellers from API (replaces mock portfolio data)
  const { data: sellersResponse } = useSellers({
    is_active: true,
    limit: 1000,
  })

  // Fetch tags from API
  const projectId = 1 // TODO: Get from auth context
  const { data: tagsData } = useTags(projectId)

  // "Last Interaction Result" filter — Path 2: backed by TA chains
  // (every ta_interactions row has a chain_id, so this works today
  // without admin-configured dropdown values). The filter answers
  // "which chain did this client most recently interact with?"
  const { data: chainsData } = useTAChains({ include_inactive: false })
  const sortedInteractionResults = useMemo(() => {
    const items = chainsData?.items ?? []
    return items
      .filter((c) => c.chain_type === 'manual')
      .map((c) => ({ id: c.id, value: c.name }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [chainsData])

  // Chain + Step picker — same chain dataset as above but ALL chain types
  // are eligible (operators may want to filter on automatic chains too).
  // The picked chain's embedded ``steps`` drive the Step dropdown.
  const allChains = useMemo(
    () => [...(chainsData?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [chainsData]
  )
  const selectedChainId = filters.chainId
  const selectedChain = useMemo(
    () => (selectedChainId ? allChains.find((c) => c.id === selectedChainId) : undefined),
    [allChains, selectedChainId]
  )
  const chainSteps = useMemo(() => selectedChain?.steps ?? [], [selectedChain])
  const selectedChainStepIds = useMemo(() => filters.chainStepIds ?? [], [filters.chainStepIds])
  const stepValues = filters.stepValues ?? {}

  // TargetActions catalog — needed for field_type / dropdown_values so
  // ClientStepValueRow can render the right input flavor per step.
  const { data: tasResp } = useTargetActions({ include_hidden: true })
  const tasById = useMemo(() => {
    const m = new Map<number, TargetAction>()
    for (const ta of tasResp?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasResp])

  // Selected steps in chain order, paired with their resolved TA. Keyed
  // by ``step.id`` (not target_action_id) so a chain with duplicate-TA
  // steps keeps them independent.
  const selectedStepRows = useMemo(() => {
    const picked = new Set(selectedChainStepIds)
    return [...chainSteps]
      .filter((s) => picked.has(s.id))
      .sort((a, b) => a.step_order - b.step_order)
      .map((s) => ({ step: s, ta: tasById.get(s.target_action_id) ?? null }))
  }, [chainSteps, selectedChainStepIds, tasById])

  const handleStepValueChange = (stepId: number, patch: Partial<StepValueEntry>) => {
    const prevEntry = stepValues[stepId] ?? {}
    const merged: StepValueEntry = { ...prevEntry, ...patch }
    // Strip empty keys so the URL stays clean.
    const clean: StepValueEntry = {}
    if (merged.eq) clean.eq = merged.eq
    if (merged.min) clean.min = merged.min
    if (merged.max) clean.max = merged.max
    const next = { ...stepValues }
    if (clean.eq || clean.min || clean.max) {
      next[stepId] = clean
    } else {
      delete next[stepId]
    }
    onFilterChange({ ...filters, stepValues: next })
  }

  // Map sellers to portfolio options (store seller objects for easy ID access)
  const portfolioOptions = useMemo(() => {
    if (!sellersResponse?.sellers) return []
    return sellersResponse.sellers.map((seller) => ({
      id: seller.id,
      name: seller.seller_name,
      displayName: `${seller.seller_name} (${seller.id})`,
    }))
  }, [sellersResponse])

  // Operators for the three operator dropdowns. Derivation lives in the shared
  // useOperatorFilterOptions hook so ClientManagementPage's "all operators
  // selected → omit filter" detection uses the exact same option set this UI
  // renders (no drift). Rule (all three): all active operators are shown; an
  // inactive operator is shown only if it has ≥1 client in the relevant role —
  // employee for Responsible Employee, searcher for Responsible Searcher, either
  // role for Interaction Created By.
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { employeeOptions, interactionUserOptions, searcherOptions } = useOperatorFilterOptions(
    activeProjectId ? Number(activeProjectId) : null
  )

  // Date-only filters: pass the picked day straight through (no
  // timezone math). The previous implementation ran the Date through
  // ``getDateStringInTimezone(date, userTimezone)``; a browser-vs-profile
  // timezone mismatch then shifted the calendar day by ±1 (you click
  // May 27, the API receives May 26 or May 28). The picker returns a
  // Date at local-midnight for the chosen day, so reading the local
  // year/month/day parts gives exactly what the user clicked.
  const handleFilterDateChange = (field: FilterDateField, date: Date | null) => {
    onFilterChange({
      ...filters,
      [field]: date ? formatPickerDateAsYMD(date) : undefined,
    })
  }

  const handlePortfolioChange = (sellerIds: number[]) => {
    onFilterChange({
      ...filters,
      portfolio: sellerIds,
    })
  }

  const handleTagsChange = (tagIds: number[]) => {
    onFilterChange({
      ...filters,
      tagIds: tagIds,
    })
  }

  const handleLastInteractionResultChange = (ids: number[]) => {
    onFilterChange({
      ...filters,
      lastInteractionResultIds: ids,
    })
  }

  const displayedPortfolios = portfolioOptions.slice(0, 3)
  const hiddenPortfoliosCount = portfolioOptions.length - 3
  const selectedSellerIds = filters.portfolio || []

  // Tag display logic (similar to portfolio)
  const tags = tagsData || []
  const displayedTags = tags.slice(0, 3)
  const hiddenTagsCount = Math.max(0, tags.length - 3)
  const selectedTagIds = filters.tagIds || []

  return (
    <div className="flex w-full flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-4 sm:p-6">
      <div className="flex w-full flex-col items-center gap-4 self-stretch sm:gap-6">
        <div className="flex w-full flex-col items-center gap-4 self-stretch sm:gap-7">
          {/* First Row: Debt Range & DPD Range */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:gap-10">
            {/* Debt Range */}
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[100px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.debtRange')}
              </label>
              <div className="flex w-full items-center gap-2 sm:flex-1">
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  ₴
                </span>
                <DebouncedNumberInput
                  value={filters.debtRangeFrom}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      debtRangeFrom: value,
                    })
                  }
                  onClear={() => onFilterChange({ ...filters, debtRangeFrom: undefined })}
                  placeholder={t('pages.clients.filters.min')}
                  className="flex flex-1 flex-col items-start gap-2"
                  formatWithCommas={true}
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DebouncedNumberInput
                  value={filters.debtRangeTo}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      debtRangeTo: value,
                    })
                  }
                  onClear={() => onFilterChange({ ...filters, debtRangeTo: undefined })}
                  placeholder={t('pages.clients.filters.max')}
                  className="flex flex-1 flex-col items-start gap-2"
                  formatWithCommas={true}
                />
              </div>
            </div>
            {/* DPD Range */}
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[100px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.dpdRange')}
              </label>
              <div className="flex w-full flex-1 items-center gap-2">
                <DebouncedNumberInput
                  value={filters.dpdRangeFrom}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      dpdRangeFrom: value,
                    })
                  }
                  onClear={() => onFilterChange({ ...filters, dpdRangeFrom: undefined })}
                  placeholder={t('pages.clients.filters.min')}
                  className="flex flex-1 flex-col items-start gap-2"
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DebouncedNumberInput
                  value={filters.dpdRangeTo}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      dpdRangeTo: value,
                    })
                  }
                  onClear={() => onFilterChange({ ...filters, dpdRangeTo: undefined })}
                  placeholder={t('pages.clients.filters.max')}
                  className="flex flex-1 flex-col items-start gap-2"
                />
                <span className="text-xs leading-[150%] font-medium tracking-[-0.24px] text-gray-700 sm:text-sm sm:tracking-[-0.28px]">
                  {t('pages.clients.filters.days')}
                </span>
              </div>
            </div>
          </div>

          {/* Second Row: Principal Amount range & Date of sale */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:gap-10">
            {/* Principal Amount (principal_min/max on open loans) — KAN-572. */}
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[100px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.amountOfDebtRange')}
              </label>
              <div className="flex w-full items-center gap-2 sm:flex-1">
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  ₴
                </span>
                <DebouncedNumberInput
                  value={filters.principalRangeFrom}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      principalRangeFrom: value,
                    })
                  }
                  onClear={() => onFilterChange({ ...filters, principalRangeFrom: undefined })}
                  placeholder={t('pages.clients.filters.min')}
                  className="flex flex-1 flex-col items-start gap-2"
                  formatWithCommas={true}
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DebouncedNumberInput
                  value={filters.principalRangeTo}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      principalRangeTo: value,
                    })
                  }
                  onClear={() => onFilterChange({ ...filters, principalRangeTo: undefined })}
                  placeholder={t('pages.clients.filters.max')}
                  className="flex flex-1 flex-col items-start gap-2"
                  formatWithCommas={true}
                />
              </div>
            </div>

            {/* Date of sale */}
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[100px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.dateOfSale')}
              </label>
              <div className="flex w-full flex-1 items-center gap-2">
                <DateSelect
                  value={filters.dateOfSaleFrom || null}
                  onChange={({ value }) => handleFilterDateChange('dateOfSaleFrom', value)}
                  onClear={() => onFilterChange({ ...filters, dateOfSaleFrom: undefined })}
                  placeholder={t('pages.clients.filters.min')}
                  allowManualInput
                  format="dd.MM.yyyy"
                  className="flex flex-1 flex-col gap-2"
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DateSelect
                  value={filters.dateOfSaleTo || null}
                  onChange={({ value }) => handleFilterDateChange('dateOfSaleTo', value)}
                  onClear={() => onFilterChange({ ...filters, dateOfSaleTo: undefined })}
                  placeholder={t('pages.clients.filters.max')}
                  allowManualInput
                  format="dd.MM.yyyy"
                  className="flex flex-1 flex-col gap-2"
                />
              </div>
            </div>
          </div>

          {/* Assignment Date */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:gap-10">
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[100px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.assignmentDate')}
              </label>
              <div className="flex w-full flex-1 items-center gap-2">
                <DateSelect
                  value={filters.assignmentDateFrom || null}
                  onChange={({ value }) => handleFilterDateChange('assignmentDateFrom', value)}
                  onClear={() => onFilterChange({ ...filters, assignmentDateFrom: undefined })}
                  placeholder={t('pages.clients.filters.min')}
                  allowManualInput
                  format="dd.MM.yyyy"
                  className="flex flex-1 flex-col gap-2"
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DateSelect
                  value={filters.assignmentDateTo || null}
                  onChange={({ value }) => handleFilterDateChange('assignmentDateTo', value)}
                  onClear={() => onFilterChange({ ...filters, assignmentDateTo: undefined })}
                  placeholder={t('pages.clients.filters.max')}
                  allowManualInput
                  format="dd.MM.yyyy"
                  className="flex flex-1 flex-col gap-2"
                />
              </div>
            </div>
            <div className="hidden sm:flex sm:min-w-[220px] sm:flex-1" />
          </div>

          {/* Target Action Date — replaces the legacy Promise + Callback
              date pickers. Matches when ANY date value entered into the
              latest TA-with-date for the client falls in
              [taDateFrom, taDateTo]. */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:gap-10">
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full shrink-0 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:max-w-[9.5rem] sm:min-w-[7.25rem] sm:text-sm sm:tracking-[-0.28px] sm:whitespace-normal">
                {t('pages.clients.filters.targetActionDate', 'Target Action Date')}
              </label>
              <div className="flex w-full flex-1 items-center gap-2">
                <DateSelect
                  value={filters.taDateFrom || null}
                  onChange={({ value }) => handleFilterDateChange('taDateFrom', value)}
                  onClear={() => onFilterChange({ ...filters, taDateFrom: undefined })}
                  placeholder={t('pages.clients.filters.min')}
                  allowManualInput
                  format="dd.MM.yyyy"
                  className="flex flex-1 flex-col gap-2"
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DateSelect
                  value={filters.taDateTo || null}
                  onChange={({ value }) => handleFilterDateChange('taDateTo', value)}
                  onClear={() => onFilterChange({ ...filters, taDateTo: undefined })}
                  placeholder={t('pages.clients.filters.max')}
                  allowManualInput
                  format="dd.MM.yyyy"
                  className="flex flex-1 flex-col gap-2"
                />
              </div>
            </div>
            {/* Spacer mirrors the second column from the previous two-row
                layout so adjacent rows stay aligned. */}
            <div className="hidden sm:flex sm:min-w-[220px] sm:flex-1" />
          </div>

          {/* Interaction Logged Date (range) & Interaction Created By (operator) */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:gap-10">
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full shrink-0 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:max-w-[9.5rem] sm:min-w-[7.25rem] sm:text-sm sm:tracking-[-0.28px] sm:whitespace-normal">
                {t('pages.clients.filters.interactionLoggedDate', 'Interaction Logged Date')}
              </label>
              <div className="flex w-full flex-1 items-center gap-2">
                <DateSelect
                  value={filters.interactionDateFrom || null}
                  onChange={({ value }) => handleFilterDateChange('interactionDateFrom', value)}
                  onClear={() => onFilterChange({ ...filters, interactionDateFrom: undefined })}
                  placeholder={t('pages.clients.filters.min')}
                  allowManualInput
                  format="dd.MM.yyyy"
                  className="flex flex-1 flex-col gap-2"
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DateSelect
                  value={filters.interactionDateTo || null}
                  onChange={({ value }) => handleFilterDateChange('interactionDateTo', value)}
                  onClear={() => onFilterChange({ ...filters, interactionDateTo: undefined })}
                  placeholder={t('pages.clients.filters.max')}
                  allowManualInput
                  format="dd.MM.yyyy"
                  className="flex flex-1 flex-col gap-2"
                />
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full shrink-0 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:max-w-[9.5rem] sm:min-w-[7.25rem] sm:text-sm sm:tracking-[-0.28px] sm:whitespace-normal">
                {t('pages.clients.filters.interactionCreatedBy', 'Interaction Created By')}
              </label>
              <div className="flex w-full flex-1 flex-col items-start gap-2">
                <OperatorMultiSelectDropdown
                  options={interactionUserOptions}
                  selectedIds={filters.interactionUserIds ?? []}
                  onSelectionChange={(ids) =>
                    onFilterChange({
                      ...filters,
                      interactionUserIds: ids,
                    })
                  }
                  searchPlaceholder={t('pages.clients.filters.selectOperator', 'Select operator')}
                  emptyText={t('pages.clients.filters.noUsersAvailable')}
                  selectAllLabel={t('pages.clients.filters.selectAllOperators', 'All operators')}
                  specialOption={{
                    id: NO_INTERACTIONS_ID,
                    label: t('pages.clients.filters.noInteractions', 'No Interactions'),
                  }}
                  testId="interaction-user-multiselect-trigger"
                  trigger={
                    <button
                      type="button"
                      className="text-dark-500 flex h-[45px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-400 bg-white px-3 py-2 text-left text-sm font-light whitespace-nowrap shadow-none focus:ring-0 focus:outline-none"
                    >
                      <span className="truncate">
                        {(() => {
                          const selected = filters.interactionUserIds ?? []
                          // Split the "No Interactions" sentinel out so it
                          // never counts as a real operator selection.
                          const hasNoInteractions = selected.includes(NO_INTERACTIONS_ID)
                          const realSelected = selected.filter((id) => id !== NO_INTERACTIONS_ID)
                          const allCount = interactionUserOptions.length
                          // "All operators" when nothing or every operator is
                          // selected — both mean "no narrowing". Not when the
                          // special option is active.
                          if (
                            !hasNoInteractions &&
                            (realSelected.length === 0 ||
                              (allCount > 0 && realSelected.length === allCount))
                          ) {
                            return t('pages.clients.filters.selectAllOperators', 'All operators')
                          }
                          const labels = [
                            ...(hasNoInteractions
                              ? [t('pages.clients.filters.noInteractions', 'No Interactions')]
                              : []),
                            ...interactionUserOptions
                              .filter((o) => realSelected.includes(o.id))
                              .map((o) => o.name),
                          ]
                          if (labels.length <= 2) {
                            return labels.join(', ')
                          }
                          return t('pages.clients.filters.selectedCount', {
                            defaultValue: '{{count}} selected',
                            count: labels.length,
                          })
                        })()}
                      </span>
                      <div className="shrink-0 opacity-50">
                        <Icons.ArrowDown size={16} className="text-current" />
                      </div>
                    </button>
                  }
                />
              </div>
            </div>
          </div>

          {/* Third Row: Portfolio */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:gap-10">
            {/* Portfolio */}
            <div className="flex w-full flex-col gap-2 sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[100px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.portfolio')}
              </label>
              <div className="flex w-full flex-1 flex-wrap items-start gap-2 sm:gap-3">
                {displayedPortfolios.map((portfolio) => (
                  <label
                    key={portfolio.id}
                    className="flex cursor-pointer items-center gap-1.5 sm:gap-2"
                  >
                    <Checkbox
                      checked={selectedSellerIds.includes(portfolio.id)}
                      onCheckedChange={(checked) => {
                        // Pass toggle action - parent will use functional update to avoid stale state
                        onFilterChange({
                          _action: 'togglePortfolio',
                          _value: portfolio.id,
                          _checked: checked,
                        } as unknown as ClientFilters)
                      }}
                    />
                    <span className="text-dark-500 text-xs sm:text-sm">
                      {portfolio.displayName}
                    </span>
                  </label>
                ))}
                {hiddenPortfoliosCount > 0 && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-secondary-800 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                      + {hiddenPortfoliosCount} {t('pages.clients.filters.more')}
                    </span>
                    <PortfolioDropdown
                      portfolios={portfolioOptions}
                      selectedSellerIds={selectedSellerIds}
                      onSelectionChange={handlePortfolioChange}
                      onClear={() => handlePortfolioChange([])}
                      onOpenChange={setPortfolioDropdownOpen}
                      trigger={
                        <button
                          type="button"
                          className="bg-primary-300 flex items-center gap-2 rounded p-1"
                        >
                          {portfolioDropdownOpen ? (
                            <Icons.ArrowUp
                              size={16}
                              className="text-secondary-800"
                              strokeWidth={2}
                            />
                          ) : (
                            <Icons.ArrowDown
                              size={16}
                              className="text-secondary-800"
                              strokeWidth={2}
                            />
                          )}
                        </button>
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fourth Row: Tags Filter */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:gap-10">
            {/* Tags Filter */}
            <div className="flex w-full flex-col gap-2 sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[100px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.tags')}
              </label>
              <div className="flex w-full flex-1 flex-wrap items-start gap-2 sm:gap-3">
                {displayedTags.map((tag) => (
                  <label key={tag.id} className="flex cursor-pointer items-center gap-1.5 sm:gap-2">
                    <Checkbox
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={(checked) => {
                        // Pass toggle action - parent will use functional update to avoid stale state
                        onFilterChange({
                          _action: 'toggleTag',
                          _value: tag.id,
                          _checked: checked,
                        } as unknown as ClientFilters)
                      }}
                    />
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <div
                        className="h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-dark-500 text-xs sm:text-sm">{tag.name}</span>
                    </div>
                  </label>
                ))}
                {hiddenTagsCount > 0 && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-secondary-800 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                      + {hiddenTagsCount} {t('pages.clients.filters.more')}
                    </span>
                    <TagsDropdown
                      tags={tags}
                      selectedTagIds={selectedTagIds}
                      onSelectionChange={handleTagsChange}
                      onClear={() => handleTagsChange([])}
                      onOpenChange={setTagsDropdownOpen}
                      trigger={
                        <button
                          type="button"
                          data-testid="tags-multiselect-trigger"
                          className="bg-primary-300 flex items-center gap-2 rounded p-1"
                        >
                          {tagsDropdownOpen ? (
                            <Icons.ArrowUp
                              size={16}
                              className="text-secondary-800"
                              strokeWidth={2}
                            />
                          ) : (
                            <Icons.ArrowDown
                              size={16}
                              className="text-secondary-800"
                              strokeWidth={2}
                            />
                          )}
                        </button>
                      }
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="hidden sm:flex sm:min-w-[220px] sm:flex-1" />
          </div>

          {/* Last Interaction Result Filter Row */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:gap-10">
            <div className="flex w-full flex-col gap-2 sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] whitespace-nowrap sm:w-auto sm:shrink-0 sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.lastInteractionResult', 'Last Interaction Result')}
              </label>
              <div className="flex w-full flex-1 items-center gap-2">
                <LastInteractionResultDropdown
                  options={sortedInteractionResults}
                  selectedIds={filters.lastInteractionResultIds || []}
                  onSelectionChange={handleLastInteractionResultChange}
                  onClear={() => handleLastInteractionResultChange([])}
                  onOpenChange={setLastInteractionResultDropdownOpen}
                  trigger={
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 sm:w-auto sm:min-w-[260px]"
                    >
                      <span className="truncate">
                        {(() => {
                          const selected = filters.lastInteractionResultIds || []
                          if (selected.length === 0) {
                            return t(
                              'pages.clients.filters.lastInteractionResultPlaceholder',
                              'Select chains...'
                            )
                          }
                          if (selected.length <= 2) {
                            return sortedInteractionResults
                              .filter((o) => selected.includes(o.id))
                              .map((o) => o.value)
                              .join(', ')
                          }
                          return t('pages.clients.filters.lastInteractionResultSelectedCount', {
                            defaultValue: '{{count}} selected',
                            count: selected.length,
                          })
                        })()}
                      </span>
                      {lastInteractionResultDropdownOpen ? (
                        <Icons.ArrowUp
                          size={16}
                          className="text-secondary-800 shrink-0"
                          strokeWidth={2}
                        />
                      ) : (
                        <Icons.ArrowDown
                          size={16}
                          className="text-secondary-800 shrink-0"
                          strokeWidth={2}
                        />
                      )}
                    </button>
                  }
                />
              </div>
            </div>
            <div className="hidden sm:flex sm:min-w-[220px] sm:flex-1" />
          </div>

          {/* Chain + Step Filter Row — narrows clients to those with at
              least one TA interaction in the picked chain and (optionally)
              in one of the picked steps. Chain reset wipes the step picks
              and their per-step values; see ClientManagementPage's
              handleFilterChange for the cascade. */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-start lg:gap-10">
            <div className="flex w-full flex-col gap-2 sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-auto sm:shrink-0 sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.chain', 'Chain')}
              </label>
              <div className="flex w-full flex-1 flex-col items-start gap-2">
                <Select
                  value={selectedChainId != null ? String(selectedChainId) : 'all'}
                  onValueChange={(v) => {
                    if (v === 'all') {
                      onFilterChange({
                        ...filters,
                        chainId: undefined,
                        chainStepIds: [],
                      })
                    } else {
                      onFilterChange({
                        ...filters,
                        chainId: Number(v),
                        chainStepIds: [],
                      })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.clients.filters.allChains', 'All chains')} />
                  </SelectTrigger>
                  <SelectContent searchable>
                    <SelectItem value="all">
                      {t('pages.clients.filters.allChains', 'All chains')}
                    </SelectItem>
                    {allChains.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-auto sm:shrink-0 sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.chainStep', 'Step')}
              </label>
              <div className="flex w-full flex-1 flex-col items-start gap-2">
                <ClientStepFilterDropdown
                  steps={chainSteps}
                  selectedIds={selectedChainStepIds}
                  onChange={(ids) =>
                    onFilterChange({
                      ...filters,
                      chainStepIds: ids,
                    })
                  }
                  disabled={selectedChainId == null}
                />
              </div>
            </div>
          </div>

          {/* Per-step value filter rows — one per picked step, laid out
              two-per-line on lg+ (single column on small screens). Input
              flavor follows the step's target_action.field_type. */}
          {selectedStepRows.length > 0 && (
            <div className="grid w-full grid-cols-1 gap-4 self-stretch lg:grid-cols-2 lg:gap-x-10">
              {selectedStepRows.map(({ step, ta }) => (
                <ClientStepValueRow
                  key={step.id}
                  step={step}
                  ta={ta}
                  value={stepValues[step.id] ?? {}}
                  onChange={(patch) => handleStepValueChange(step.id, patch)}
                />
              ))}
            </div>
          )}

          {/* Fifth Row: Responsible employee & Responsible searcher */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-start lg:gap-10">
            {/* Responsible employee (multi-select OR, KAN-572) */}
            <div className="flex w-full flex-col gap-2 sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-auto sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.responsibleEmployee')}
              </label>
              <div className="flex w-full flex-1 flex-col items-start gap-2">
                <OperatorMultiSelectDropdown
                  options={employeeOptions}
                  selectedIds={filters.responsibleEmployeeIds ?? []}
                  onSelectionChange={(ids) =>
                    onFilterChange({
                      ...filters,
                      responsibleEmployeeIds: ids,
                    })
                  }
                  searchPlaceholder={t('pages.clients.filters.selectEmployee')}
                  emptyText={t('pages.clients.filters.noUsersAvailable')}
                  selectAllLabel={t('pages.clients.filters.selectAllEmployees', 'All employees')}
                  specialOption={{
                    id: NO_RESPONSIBLE_ID,
                    label: t('pages.clients.filters.noResponsible', 'No Responsible'),
                  }}
                  testId="responsible-employee-multiselect-trigger"
                  trigger={
                    <button
                      type="button"
                      className="text-dark-500 flex h-[45px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-400 bg-white px-3 py-2 text-left text-sm font-light whitespace-nowrap shadow-none focus:ring-0 focus:outline-none"
                    >
                      <span className="truncate">
                        {(() => {
                          const selected = filters.responsibleEmployeeIds ?? []
                          // Split the "No Responsible" sentinel out so it never
                          // counts as a real employee selection.
                          const hasNoResponsible = selected.includes(NO_RESPONSIBLE_ID)
                          const realSelected = selected.filter((id) => id !== NO_RESPONSIBLE_ID)
                          const allCount = employeeOptions.length
                          if (
                            !hasNoResponsible &&
                            (realSelected.length === 0 ||
                              (allCount > 0 && realSelected.length === allCount))
                          ) {
                            return t('pages.clients.filters.selectAllEmployees', 'All employees')
                          }
                          const labels = [
                            ...(hasNoResponsible
                              ? [t('pages.clients.filters.noResponsible', 'No Responsible')]
                              : []),
                            ...employeeOptions
                              .filter((o) => realSelected.includes(o.id))
                              .map((o) => o.name),
                          ]
                          if (labels.length <= 2) {
                            return labels.join(', ')
                          }
                          return t('pages.clients.filters.selectedCount', {
                            defaultValue: '{{count}} selected',
                            count: labels.length,
                          })
                        })()}
                      </span>
                      <div className="shrink-0 opacity-50">
                        <Icons.ArrowDown size={16} className="text-current" />
                      </div>
                    </button>
                  }
                />
              </div>
            </div>

            {/* Responsible searcher */}
            <div className="flex w-full flex-col gap-2 sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-auto sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.responsibleSearcher')}
              </label>
              <div className="flex w-full flex-1 flex-col items-start gap-2">
                <Select
                  value={filters.responsibleSearcher || undefined}
                  onValueChange={(value) =>
                    onFilterChange({
                      ...filters,
                      responsibleSearcher: value === 'none' ? undefined : value,
                    })
                  }
                  onClear={() => onFilterChange({ ...filters, responsibleSearcher: undefined })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.clients.filters.selectSearcher')} />
                  </SelectTrigger>
                  <SelectContent searchable>
                    <SelectItem value="none">
                      {t('pages.clients.filters.selectSearcher')}
                    </SelectItem>
                    {searcherOptions.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-gray-500">
                        {t('pages.clients.filters.noUsersAvailable')}
                      </div>
                    ) : (
                      searcherOptions.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.isInactive ? (
                            <span className="text-gray-400">
                              {user.name} {t('pages.clients.filters.inactiveSuffix', '(blocked)')}
                            </span>
                          ) : (
                            user.name
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Sixth Row: Unassigned only checkbox - HIDDEN */}
          {/* <div className="flex w-full items-start gap-4 self-stretch lg:gap-10">
            <div className="flex w-full flex-col gap-2 sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 sm:gap-2">
                <Checkbox
                  checked={filters.unassignedOnly || false}
                  onCheckedChange={(checked) =>
                    onFilterChange({
                      ...filters,
                      unassignedOnly: checked as boolean,
                    })
                  }
                />
                <span className="text-dark-500 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:text-sm sm:tracking-[-0.28px]">
                  {t('pages.clients.filters.unassignedOnly')}
                </span>
              </label>
            </div>
            <div className="hidden sm:flex sm:min-w-[220px] sm:flex-1" />
          </div> */}
        </div>
      </div>
    </div>
  )
}
