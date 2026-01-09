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
import { useSellers } from '@/features/sellers/hooks/useSellers'
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

// Status options matching backend Client.status field (services/client/app/routers/clients.py:440)
// Valid statuses: new, active, closed
const statusOptions = ['new', 'active', 'closed']

export function ClientFiltersBar({ filters, onFilterChange }: ClientFiltersBarProps) {
  const { t } = useTranslation('common')
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(false)

  // Fetch sellers from API (replaces mock portfolio data)
  const { data: sellersResponse } = useSellers({
    is_active: true,
    limit: 1000,
  })

  // Map sellers to portfolio options
  // For now, using "Seller Name (ID)" format for clarity
  // The portfolio filter stores these values, which are parsed to extract IDs for the API
  const portfolioOptions = useMemo(() => {
    if (!sellersResponse?.sellers) return []
    return sellersResponse.sellers.map((seller) => `${seller.seller_name} (${seller.id})`)
  }, [sellersResponse])

  const handleDateChange = (field: 'dateOfSaleFrom' | 'dateOfSaleTo', date: Date | null) => {
    onFilterChange({
      ...filters,
      [field]: date ? date.toISOString().split('T')[0] : undefined,
    })
  }

  const handlePortfolioChange = (portfolios: string[]) => {
    onFilterChange({
      ...filters,
      portfolio: portfolios,
    })
  }

  const handleStatusChange = (status: string, checked: boolean) => {
    const currentStatuses = filters.status || []
    onFilterChange({
      ...filters,
      status: checked ? [...currentStatuses, status] : currentStatuses.filter((s) => s !== status),
    })
  }

  const displayedPortfolios = portfolioOptions.slice(0, 3)
  const hiddenPortfoliosCount = portfolioOptions.length - 3
  const selectedPortfolios = filters.portfolio || []

  return (
    <div className="flex flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-6">
      <div className="flex flex-col items-center gap-6 self-stretch">
        <div className="flex flex-col items-center gap-7 self-stretch">
          <div className="flex items-center gap-10 self-stretch">
            {/* Debt Range */}
            <div className="flex flex-1 items-center gap-3">
              <label className="text-dark-500 w-[100px] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.filters.debtRange')}
              </label>
              <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                ₴
              </span>
              <div className="flex flex-1 items-center gap-2">
                <DebouncedNumberInput
                  value={filters.debtRangeFrom}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      debtRangeFrom: value,
                    })
                  }
                  placeholder="10,000"
                  className="flex flex-1 flex-col items-start gap-2"
                  formatWithCommas={true}
                />
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
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
                  placeholder="50,000"
                  className="flex flex-1 flex-col items-start gap-2"
                  formatWithCommas={true}
                />
              </div>
            </div>
            {/* DPD Range */}
            <div className="flex flex-1 items-center gap-3">
              <label className="text-dark-500 w-[100px] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.filters.dpdRange')}
              </label>
              <div className="flex flex-1 items-center gap-2">
                <DebouncedNumberInput
                  value={filters.dpdRangeFrom}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      dpdRangeFrom: value,
                    })
                  }
                  placeholder="10"
                  className="flex flex-1 flex-col items-start gap-2"
                />
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
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
                  placeholder="60"
                  className="flex flex-1 flex-col items-start gap-2"
                />
                <span className="text-sm leading-[150%] font-medium tracking-[-0.28px] text-gray-700">
                  {t('pages.clients.filters.days')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-10 self-stretch">
            {/* Amount of debt range */}
            <div className="flex flex-1 items-center gap-3">
              <label className="text-dark-500 w-[100px] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.filters.amountOfDebtRange')}
              </label>
              <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                ₴
              </span>
              <div className="flex flex-1 items-center gap-2">
                <DebouncedNumberInput
                  value={filters.amountOfDebtRangeFrom}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      amountOfDebtRangeFrom: value,
                    })
                  }
                  placeholder="10,000"
                  className="flex flex-1 flex-col items-start gap-2"
                  formatWithCommas={true}
                />
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                  -
                </span>
                <DebouncedNumberInput
                  value={filters.amountOfDebtRangeTo}
                  onChange={(value) =>
                    onFilterChange({
                      ...filters,
                      amountOfDebtRangeTo: value,
                    })
                  }
                  placeholder="50,000"
                  className="flex flex-1 flex-col items-start gap-2"
                  formatWithCommas={true}
                />
              </div>
            </div>

            {/* Date of sale */}
            <div className="flex flex-1 items-center gap-3">
              <label className="text-dark-500 w-[100px] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.filters.dateOfSale')}
              </label>
              <DateSelect
                value={filters.dateOfSaleFrom || null}
                onChange={({ value }) => handleDateChange('dateOfSaleFrom', value)}
                placeholder={`${new Date().getFullYear()}-01-01`}
                format="yyyy-MM-dd"
                className="flex flex-1 flex-col gap-2"
              />
              <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                -
              </span>
              <DateSelect
                value={filters.dateOfSaleTo || null}
                onChange={({ value }) => handleDateChange('dateOfSaleTo', value)}
                placeholder={`${new Date().getFullYear()}-12-31`}
                format="yyyy-MM-dd"
                className="flex flex-1 flex-col gap-2"
              />
            </div>
          </div>
          <div className="flex items-center gap-10 self-stretch">
            {/* Portfolio */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <label className="text-dark-500 w-[100px] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.filters.portfolio')}
              </label>
              <div className="flex flex-1 flex-wrap items-start gap-3">
                {displayedPortfolios.map((portfolio) => (
                  <label key={portfolio} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={selectedPortfolios.includes(portfolio)}
                      onCheckedChange={(checked) => {
                        const current = filters.portfolio || []
                        onFilterChange({
                          ...filters,
                          portfolio: checked
                            ? [...current, portfolio]
                            : current.filter((p) => p !== portfolio),
                        })
                      }}
                    />
                    <span className="text-dark-500 text-sm">{portfolio}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-secondary-800 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  + {hiddenPortfoliosCount} {t('pages.clients.filters.more')}
                </span>
                {hiddenPortfoliosCount > 0 && (
                  <PortfolioDropdown
                    portfolios={portfolioOptions}
                    selectedPortfolios={selectedPortfolios}
                    onSelectionChange={handlePortfolioChange}
                    onOpenChange={setPortfolioDropdownOpen}
                    trigger={
                      <button
                        type="button"
                        className="bg-primary-300 flex items-center gap-2 rounded p-1"
                      >
                        {portfolioDropdownOpen ? (
                          <Icons.ArrowUp size={16} className="text-secondary-800" strokeWidth={2} />
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
                )}
              </div>
            </div>

            {/* Status */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <label className="text-dark-500 w-[100px] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.filters.status')}
              </label>
              <div className="flex flex-1 items-center gap-8">
                {statusOptions.map((status) => {
                  const statusKey = status.toLowerCase().replace(/[\s_]/g, '')
                  return (
                    <label key={status} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={(filters.status || []).includes(status)}
                        onCheckedChange={(checked) =>
                          handleStatusChange(status, checked as boolean)
                        }
                      />
                      <span className="text-dark-500 text-sm">
                        {t(`pages.clients.statuses.${statusKey}`)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-10 self-stretch">
            {/* Responsible employee */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.filters.responsibleEmployee')}
              </label>
              <div className="flex flex-1 flex-col items-start gap-2">
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
                  <SelectContent>
                    <SelectItem value="none">
                      {t('pages.clients.filters.selectEmployee')}
                    </SelectItem>
                    {/* TODO: Add actual employee list */}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Responsible searcher */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <label className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.filters.responsibleSearcher')}
              </label>
              <div className="flex flex-1 flex-col items-start gap-2">
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
                  <SelectContent>
                    <SelectItem value="none">
                      {t('pages.clients.filters.selectSearcher')}
                    </SelectItem>
                    {/* TODO: Add actual searcher list */}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-10 self-stretch">
            {/* Unassigned only checkbox */}
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={filters.unassignedOnly || false}
                  onCheckedChange={(checked) =>
                    onFilterChange({
                      ...filters,
                      unassignedOnly: checked as boolean,
                    })
                  }
                />
                <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                  {t('pages.clients.filters.unassignedOnly')}
                </span>
              </label>
            </div>
            <div className="flex min-w-[220px] flex-1" />
          </div>
        </div>
      </div>
    </div>
  )
}
