/**
 * Search Results Component
 *
 * Displays search results in a dropdown with loading, results, no results, and error states.
 */

import { Icons } from '@/lib/icons'
import { PriorityBadge } from '@/pages/ClientManagement/components/PriorityBadge'

export interface SearchResult {
  id: number
  name: string
  debt: number
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
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(amount)
      .replace(/,/g, ' ')
  }

  // Don't show anything if no query
  if (!query.trim()) {
    return null
  }

  // Loading State
  if (isLoading) {
    return (
      <div className="absolute top-full z-50 mt-2 w-[448px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="border-primary-500 h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-sm text-gray-600">Searching...</span>
        </div>
      </div>
    )
  }

  // Error State
  if (error) {
    return (
      <div className="absolute top-full z-50 mt-2 w-[448px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Icons.Warning size={20} className="text-error-500" strokeWidth={2} />
          <span className="text-sm text-gray-600">Could not search clients. Please try again.</span>
        </div>
      </div>
    )
  }

  // No Results State
  if (!results || results.length === 0) {
    return (
      <div className="absolute top-full z-50 mt-2 w-[448px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-400">
            <Icons.Close size={12} className="text-gray-400" strokeWidth={2} />
          </div>
          <span className="text-sm text-gray-600">No clients found for &apos;{query}&apos;.</span>
        </div>
      </div>
    )
  }

  // Results State
  return (
    <div className="absolute top-full z-50 mt-2 w-[448px] rounded-lg border border-gray-200 bg-white shadow-lg">
      <div className="max-h-[400px] overflow-y-auto">
        {results.map((result) => (
          <button
            key={result.id}
            onClick={() => onResultClick?.(result)}
            className="w-full border-b border-gray-100 p-4 text-left transition-colors last:border-b-0 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-dark-500 mb-2 text-sm font-medium">{result.name}</h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>Debt: {formatCurrency(result.debt)} ₴</div>
                  <div>Phone: {result.phone}</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <PriorityBadge priority={result.priority} variant="compact" />
                <span className="text-dark-500 text-sm font-medium">{result.score}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {results.length > 0 && onViewAll && (
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={onViewAll}
            className="bg-primary-300 text-dark-500 hover:bg-primary-400 w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            View all results
          </button>
        </div>
      )}
    </div>
  )
}
