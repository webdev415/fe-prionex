/**
 * Search Results Component
 *
 * Displays search results in a dropdown with loading, results, no results, and error states.
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { PriorityBadge } from '@/pages/ClientManagement/components/PriorityBadge'

export interface SearchResult {
  id: number
  name: string
  debt: string
  phone: string
  priority: 'Critical' | 'High' | 'Medium' | 'Low'
  score: number
}

interface SearchResultsProps {
  query: string
  searchType: string
  results?: SearchResult[]
  isLoading?: boolean
  error?: string | null
  onViewAll?: () => void
  onResultClick?: (result: SearchResult) => void
}

export function SearchResults({
  query,
  results,
  isLoading = false,
  error = null,
  onViewAll,
  onResultClick,
}: SearchResultsProps) {
  const { t, i18n } = useTranslation('common')

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '0'
    const locale = i18n.language === 'uk' ? 'uk-UA' : i18n.language === 'ru' ? 'ru-RU' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(num)
      .replace(/,/g, ' ')
  }

  // Don't show anything if no query
  if (!query.trim()) {
    return null
  }

  // Shared dropdown positioning: align with search bar, match its responsive width (w-full = parent = SearchBar)
  const dropdownBase =
    'absolute left-0 top-full z-50 mt-2 w-full min-w-0 rounded-lg border border-gray-200 bg-white shadow-lg'

  // Loading State
  if (isLoading) {
    return (
      <div className={cn(dropdownBase, 'p-3 sm:p-4')}>
        <div className="flex items-center gap-3">
          <div className="border-primary-500 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-sm text-gray-600">{t('search.searching')}</span>
        </div>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className={cn(dropdownBase, 'p-3 sm:p-4')}>
        <div className="flex items-center gap-3">
          <Icons.Warning size={20} className="text-error-500 shrink-0" strokeWidth={2} />
          <span className="text-sm text-gray-600">{t('search.error')}</span>
        </div>
      </div>
    )
  }

  // No Results State
  if (!results || results.length === 0) {
    return (
      <div className={cn(dropdownBase, 'p-3 sm:p-4')}>
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-400">
            <Icons.Close size={12} className="text-gray-400" strokeWidth={2} />
          </div>
          <span className="text-sm text-gray-600">{t('search.noResults', { query })}</span>
        </div>
      </div>
    )
  }

  // Results State
  return (
    <div className={dropdownBase}>
      <div className="max-h-[60vh] overflow-y-auto sm:max-h-[400px]">
        {results.map((result) => (
          <button
            key={result.id}
            onClick={() => onResultClick?.(result)}
            className="w-full border-b border-gray-100 p-3 text-left transition-colors last:border-b-0 hover:bg-gray-50 sm:p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <h4 className="text-dark-500 mb-1.5 truncate text-sm font-medium sm:mb-2">
                  {result.name}
                </h4>
                <div className="space-y-0.5 text-xs text-gray-600 sm:space-y-1">
                  <div className="truncate">
                    {t('search.debt')}: {formatCurrency(result.debt)} ₴
                  </div>
                  <div className="truncate">
                    {t('search.phone')}: {result.phone}
                  </div>
                </div>
              </div>
              <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end sm:gap-2">
                <PriorityBadge priority={result.priority} variant="compact" />
                <span className="text-dark-500 shrink-0 text-sm font-medium">{result.score}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {results.length > 0 && onViewAll && (
        <div className="border-t border-gray-200 p-2 sm:p-3">
          <button
            onClick={onViewAll}
            className="bg-primary-300 text-dark-500 hover:bg-primary-400 w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {t('search.viewAllResults')}
          </button>
        </div>
      )}
    </div>
  )
}
