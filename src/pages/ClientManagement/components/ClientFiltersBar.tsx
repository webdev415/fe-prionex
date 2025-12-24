/**
 * Client Filters Bar Component
 *
 * Collapsible filter bar with multiple filter options for client management.
 */

import { useState } from 'react'
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
import type { ClientFilters } from '../ClientManagementPage'

interface ClientFiltersBarProps {
  filters: ClientFilters
  onFilterChange: (filters: ClientFilters) => void
}

const portfolioOptions = [
  'Portfolio A',
  'Portfolio B',
  'Portfolio C',
  'Portfolio D',
  'Portfolio E',
  'Portfolio F',
  'Portfolio G',
  'Portfolio H',
]
// Status options matching backend Client.status field
// TODO: Update these when proper status workflow is implemented
const statusOptions = ['new', 'active', 'contacted', 'in_progress', 'paid', 'defaulted', 'closed']

export function ClientFiltersBar({ filters, onFilterChange }: ClientFiltersBarProps) {
  const { t } = useTranslation('common')
  const [portfolioDropdownOpen, setPortfolioDropdownOpen] = useState(false)

  const handleDebtRangeChange = (field: 'debtRangeFrom' | 'debtRangeTo', value: string) => {
    onFilterChange({
      ...filters,
      [field]: value ? Number(value.replace(/,/g, '')) : undefined,
    })
  }

  const handleAmountOfDebtRangeChange = (
    field: 'amountOfDebtRangeFrom' | 'amountOfDebtRangeTo',
    value: string
  ) => {
    onFilterChange({
      ...filters,
      [field]: value ? Number(value.replace(/,/g, '')) : undefined,
    })
  }

  const handleDpdRangeChange = (field: 'dpdRangeFrom' | 'dpdRangeTo', value: string) => {
    onFilterChange({
      ...filters,
      [field]: value ? Number(value) : undefined,
    })
  }

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

  const formatNumber = (value: number | undefined) => {
    if (!value) return ''
    return new Intl.NumberFormat('uk-UA').format(value)
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
                <Input
                  type="text"
                  value={formatNumber(filters.debtRangeFrom)}
                  onChange={(e) => handleDebtRangeChange('debtRangeFrom', e.target.value)}
                  placeholder="10,000"
                  className="flex flex-1 flex-col items-start gap-2"
                />
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                  -
                </span>
                <Input
                  type="text"
                  value={formatNumber(filters.debtRangeTo)}
                  onChange={(e) => handleDebtRangeChange('debtRangeTo', e.target.value)}
                  placeholder="50,000"
                  className="flex flex-1 flex-col items-start gap-2"
                />
              </div>
            </div>
            {/* DPD Range */}
            <div className="flex flex-1 items-center gap-3">
              <label className="text-dark-500 w-[100px] text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.clients.filters.dpdRange')}
              </label>
              <div className="flex flex-1 items-center gap-2">
                <Input
                  type="number"
                  value={filters.dpdRangeFrom?.toString() || ''}
                  onChange={(e) => handleDpdRangeChange('dpdRangeFrom', e.target.value)}
                  placeholder="10"
                  className="flex flex-1 flex-col items-start gap-2"
                />
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                  -
                </span>
                <Input
                  type="number"
                  value={filters.dpdRangeTo?.toString() || ''}
                  onChange={(e) => handleDpdRangeChange('dpdRangeTo', e.target.value)}
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
                <Input
                  type="text"
                  value={formatNumber(filters.amountOfDebtRangeFrom)}
                  onChange={(e) =>
                    handleAmountOfDebtRangeChange('amountOfDebtRangeFrom', e.target.value)
                  }
                  placeholder="10,000"
                  className="flex flex-1 flex-col items-start gap-2"
                />
                <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                  -
                </span>
                <Input
                  type="text"
                  value={formatNumber(filters.amountOfDebtRangeTo)}
                  onChange={(e) =>
                    handleAmountOfDebtRangeChange('amountOfDebtRangeTo', e.target.value)
                  }
                  placeholder="50,000"
                  className="flex flex-1 flex-col items-start gap-2"
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
                placeholder="2024-11-20"
                format="yyyy-MM-dd"
                className="flex flex-1 flex-col gap-2"
              />
              <span className="text-base leading-[155%] font-medium tracking-[-0.32px] text-gray-700">
                -
              </span>
              <DateSelect
                value={filters.dateOfSaleTo || null}
                onChange={({ value }) => handleDateChange('dateOfSaleTo', value)}
                placeholder="2024-11-20"
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
        </div>
      </div>
    </div>
  )
}
