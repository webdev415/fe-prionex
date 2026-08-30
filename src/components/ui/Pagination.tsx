/* eslint-disable react-refresh/only-export-components -- the default option set
   belongs with the component that renders it; consumers parsing a URL page size
   against it must read the same array, not a copy (same precedent as
   SegmentedTabs.tsx's id helpers) */
/**
 * Pagination Component
 *
 * Reusable pagination component for navigating through paginated data.
 * Includes rows per page selector, page navigation, and page indicator.
 * Matches the design with dark green active page and clean layout.
 */

import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'

export interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Current page size (items per page) */
  pageSize: number
  /** Available page size options */
  pageSizeOptions?: number[]
  /** Callback when page changes */
  onPageChange: (page: number) => void
  /** Callback when page size changes */
  onPageSizeChange: (pageSize: number) => void
  /** Custom className for the container */
  className?: string
}

/**
 * The sizes the dropdown offers when a consumer names none. Exported because
 * whoever parses a page size out of the URL has to accept exactly this set —
 * a second copy would drift into a URL value the dropdown cannot select.
 */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const { t } = useTranslation('common')
  type PageToken = number | 'ellipsis'

  const getPaginationTokens = (): PageToken[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const tokens: PageToken[] = [1]
    let start = Math.max(2, currentPage - 1)
    let end = Math.min(totalPages - 1, currentPage + 1)

    if (currentPage <= 3) {
      start = 2
      end = 4
    } else if (currentPage >= totalPages - 2) {
      start = totalPages - 3
      end = totalPages - 1
    }

    if (start > 2) {
      tokens.push('ellipsis')
    }

    for (let page = start; page <= end; page++) {
      tokens.push(page)
    }

    if (end < totalPages - 1) {
      tokens.push('ellipsis')
    }

    tokens.push(totalPages)
    return tokens
  }

  const visibleTokens = getPaginationTokens()

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center justify-between gap-2 py-4 sm:gap-4',
        className
      )}
    >
      {/* Rows per page selector (Left) - minimized on mobile */}
      <div className="flex items-center gap-2">
        {/* Hidden on mobile, shown on desktop */}
        <span className="text-foreground hidden text-sm font-light md:inline">
          {t('components.pagination.rowsPerPage', 'Rows per page:')}
        </span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            onPageSizeChange(Number(value))
            // Reset to first page when changing page size
            onPageChange(1)
          }}
        >
          <SelectTrigger className="h-auto w-auto min-w-[50px] border-0 bg-transparent p-0 shadow-none focus:ring-0 md:min-w-[60px]">
            <SelectValue className="text-foreground text-xs font-medium md:text-sm" />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pagination controls (Center) - responsive spacing */}
      <div className="flex max-w-full items-center gap-1 overflow-x-auto sm:gap-2">
        {/* Previous Arrow - smaller on mobile */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="border-border bg-card hover:bg-muted disabled:hover:bg-card flex h-8 w-8 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
          aria-label={t('components.pagination.previousPage', 'Previous page')}
        >
          <Icons.ArrowLeft size={14} className="text-foreground sm:h-4 sm:w-4" strokeWidth={1.5} />
        </button>

        {visibleTokens.map((token, index) =>
          token === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className="text-foreground flex h-8 min-w-[2rem] shrink-0 items-center justify-center px-1 text-xs font-medium sm:h-10 sm:min-w-[2.5rem] sm:text-sm"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button
              key={token}
              onClick={() => onPageChange(token)}
              className={cn(
                'flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-full px-2 text-xs font-medium tabular-nums transition-colors sm:h-10 sm:min-w-[2.5rem] sm:text-sm',
                currentPage === token
                  ? 'bg-secondary-800 text-white'
                  : 'text-foreground border-border bg-card hover:bg-muted border'
              )}
              aria-label={t('components.pagination.goToPage', {
                defaultValue: 'Go to page {{page}}',
                page: token,
              })}
              aria-current={currentPage === token ? 'page' : undefined}
              title={String(token)}
            >
              {token}
            </button>
          )
        )}

        {/* Next Arrow - smaller on mobile */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="border-border bg-card hover:bg-muted disabled:hover:bg-card flex h-8 w-8 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:h-10 sm:w-10"
          aria-label={t('components.pagination.nextPage', 'Next page')}
        >
          <Icons.ArrowRight size={14} className="text-foreground sm:h-4 sm:w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Page indicator (Right) - minimized on mobile */}
      <div className="flex items-center gap-1">
        {/* Hidden on mobile, shown on desktop */}
        <span className="text-foreground hidden text-sm font-light md:inline">
          {t('components.pagination.page', 'Page')}
        </span>
        <span className="text-foreground text-xs font-medium md:text-sm">{currentPage}</span>
        <span className="text-muted-foreground text-xs font-light md:text-sm">
          {t('components.pagination.of', 'of')}
        </span>
        <span className="text-foreground text-xs font-medium md:text-sm">{totalPages}</span>
      </div>
    </div>
  )
}

export default Pagination
