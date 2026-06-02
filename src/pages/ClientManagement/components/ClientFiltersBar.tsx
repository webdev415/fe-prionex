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
import { useSellers } from '@/features/sellers/hooks/useSellers'
import { useOperators } from '@/features/users/hooks/useUsers'
import { useClientAssigneeIds } from '@/features/clients/hooks/useClients'
import { useTags } from '@/features/tags/hooks/useTags'
import { useTAChains } from '@/features/taChains'
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
}: {
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
  className?: string
  formatWithCommas?: boolean
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

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
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

  // Map sellers to portfolio options (store seller objects for easy ID access)
  const portfolioOptions = useMemo(() => {
    if (!sellersResponse?.sellers) return []
    return sellersResponse.sellers.map((seller) => ({
      id: seller.id,
      name: seller.seller_name,
      displayName: `${seller.seller_name} (${seller.id})`,
    }))
  }, [sellersResponse])

  // Operators (active + inactive, non-deleted) for the three operator dropdowns,
  // plus the per-role assignee id sets that gate which *inactive* operators
  // appear. Rule (all three): all active operators are shown; an inactive
  // operator is shown only if it has ≥1 client in the relevant role — employee
  // for Responsible Employee, searcher for Responsible Searcher, either role
  // for Interaction Created By.
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators } = useOperators(activeProjectId ? Number(activeProjectId) : null, {
    includeInactive: true,
  })
  const { data: assigneeIds } = useClientAssigneeIds(!!activeProjectId)

  const { employeeIds, searcherIds, anyAssignedIds } = useMemo(() => {
    const emp = new Set<number>(assigneeIds?.employee_ids ?? [])
    const sea = new Set<number>(assigneeIds?.searcher_ids ?? [])
    return {
      employeeIds: emp,
      searcherIds: sea,
      anyAssignedIds: new Set<number>([...emp, ...sea]),
    }
  }, [assigneeIds])

  // active → always shown; inactive → only if present in the gate set.
  const interactionUserOptions = useMemo(
    () =>
      (operators ?? [])
        .filter((u) => u.status === 'active' || anyAssignedIds.has(u.id))
        .map((u) => ({
          id: u.id.toString(),
          name: u.full_name,
          isInactive: u.status !== 'active',
        })),
    [operators, anyAssignedIds]
  )
  const employeeOptions = useMemo(
    () =>
      (operators ?? [])
        .filter((u) => u.status === 'active' || employeeIds.has(u.id))
        .map((u) => ({
          id: u.id.toString(),
          name: u.full_name,
          isInactive: u.status !== 'active',
        })),
    [operators, employeeIds]
  )
  const searcherOptions = useMemo(
    () =>
      (operators ?? [])
        .filter((u) => u.status === 'active' || searcherIds.has(u.id))
        .map((u) => ({
          id: u.id.toString(),
          name: u.full_name,
          isInactive: u.status !== 'active',
        })),
    [operators, searcherIds]
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
                  placeholder={t('pages.clients.filters.max')}
                  className="flex flex-1 flex-col items-start gap-2"
                />
                <span className="text-xs leading-[150%] font-medium tracking-[-0.24px] text-gray-700 sm:text-sm sm:tracking-[-0.28px]">
                  {t('pages.clients.filters.days')}
                </span>
              </div>
            </div>
          </div>

          {/* Second Row: Amount of debt range & Date of sale */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:gap-10">
            {/* Individual Debt Amount (total_debt_min/max) */}
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-[100px] sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.amountOfDebtRange')}
              </label>
              <div className="flex w-full items-center gap-2 sm:flex-1">
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  ₴
                </span>
                <DebouncedNumberInput
                  value={filters.totalDebtRangeFrom}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      totalDebtRangeFrom: value,
                    })
                  }
                  placeholder={t('pages.clients.filters.min')}
                  className="flex flex-1 flex-col items-start gap-2"
                  formatWithCommas={true}
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DebouncedNumberInput
                  value={filters.totalDebtRangeTo}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      totalDebtRangeTo: value,
                    })
                  }
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
                  placeholder={t('pages.clients.filters.min')}
                  format="yyyy-MM-dd"
                  className="flex flex-1 flex-col gap-2"
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DateSelect
                  value={filters.dateOfSaleTo || null}
                  onChange={({ value }) => handleFilterDateChange('dateOfSaleTo', value)}
                  placeholder={t('pages.clients.filters.max')}
                  format="yyyy-MM-dd"
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
                  placeholder={t('pages.clients.filters.min')}
                  format="yyyy-MM-dd"
                  className="flex flex-1 flex-col gap-2"
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DateSelect
                  value={filters.assignmentDateTo || null}
                  onChange={({ value }) => handleFilterDateChange('assignmentDateTo', value)}
                  placeholder={t('pages.clients.filters.max')}
                  format="yyyy-MM-dd"
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
                  placeholder={t('pages.clients.filters.min')}
                  format="yyyy-MM-dd"
                  className="flex flex-1 flex-col gap-2"
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DateSelect
                  value={filters.taDateTo || null}
                  onChange={({ value }) => handleFilterDateChange('taDateTo', value)}
                  placeholder={t('pages.clients.filters.max')}
                  format="yyyy-MM-dd"
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
                  placeholder={t('pages.clients.filters.min')}
                  format="yyyy-MM-dd"
                  className="flex flex-1 flex-col gap-2"
                />
                <span className="text-sm leading-[155%] font-medium tracking-[-0.28px] text-gray-700 sm:text-base sm:tracking-[-0.32px]">
                  -
                </span>
                <DateSelect
                  value={filters.interactionDateTo || null}
                  onChange={({ value }) => handleFilterDateChange('interactionDateTo', value)}
                  placeholder={t('pages.clients.filters.max')}
                  format="yyyy-MM-dd"
                  className="flex flex-1 flex-col gap-2"
                />
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full shrink-0 text-xs leading-[150%] font-medium tracking-[-0.24px] sm:max-w-[9.5rem] sm:min-w-[7.25rem] sm:text-sm sm:tracking-[-0.28px] sm:whitespace-normal">
                {t('pages.clients.filters.interactionCreatedBy', 'Interaction Created By')}
              </label>
              <div className="flex w-full flex-1 flex-col items-start gap-2">
                <Select
                  value={filters.interactionUserId || undefined}
                  onValueChange={(value) =>
                    onFilterChange({
                      ...filters,
                      interactionUserId: value === 'none' ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('pages.clients.filters.selectOperator', 'Select operator')}
                    />
                  </SelectTrigger>
                  <SelectContent searchable>
                    <SelectItem value="none">
                      {t('pages.clients.filters.selectOperator', 'Select operator')}
                    </SelectItem>
                    {interactionUserOptions.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-gray-500">
                        {t('pages.clients.filters.noUsersAvailable')}
                      </div>
                    ) : (
                      interactionUserOptions.map((user) => (
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

          {/* Fifth Row: Responsible employee & Responsible searcher */}
          <div className="flex w-full flex-col gap-4 self-stretch lg:flex-row lg:items-start lg:gap-10">
            {/* Responsible employee */}
            <div className="flex w-full flex-col gap-2 sm:min-w-[220px] sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
              <label className="text-dark-500 w-full text-xs leading-[150%] font-medium tracking-[-0.24px] sm:w-auto sm:text-sm sm:tracking-[-0.28px]">
                {t('pages.clients.filters.responsibleEmployee')}
              </label>
              <div className="flex w-full flex-1 flex-col items-start gap-2">
                <Select
                  value={filters.responsibleEmployee || undefined}
                  onValueChange={(value) =>
                    onFilterChange({
                      ...filters,
                      responsibleEmployee: value === 'none' ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.clients.filters.selectEmployee')} />
                  </SelectTrigger>
                  <SelectContent searchable>
                    <SelectItem value="none">
                      {t('pages.clients.filters.selectEmployee')}
                    </SelectItem>
                    {employeeOptions.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-gray-500">
                        {t('pages.clients.filters.noUsersAvailable')}
                      </div>
                    ) : (
                      employeeOptions.map((user) => (
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
