/**
 * Pagination Component
 *
 * Reusable pagination component for navigating through paginated data.
 * Includes rows per page selector, page navigation, and page indicator.
 * Matches the design with dark green active page and clean layout.
 */

import { Icons } from '@/lib/icons'
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

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  // Generate visible page numbers
  const getVisiblePages = () => {
    if (totalPages <= 5) {
      // Show all pages if 5 or fewer
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: number[] = []

    // Always show first page
    pages.push(1)

    // Determine pages around current
    if (currentPage <= 3) {
      // Near the start: show 1, 2, 3, 4
      for (let i = 2; i <= 4; i++) {
        pages.push(i)
      }
    } else if (currentPage >= totalPages - 2) {
      // Near the end: show last-3, last-2, last-1, last
      for (let i = totalPages - 3; i <= totalPages; i++) {
        if (i > 1 && !pages.includes(i)) {
          pages.push(i)
        }
      }
    } else {
      // In the middle: show current-1, current, current+1
      pages.push(currentPage - 1)
      pages.push(currentPage)
      pages.push(currentPage + 1)
    }

    // Always show last page if not already included
    if (!pages.includes(totalPages)) {
      pages.push(totalPages)
    }

    return pages.sort((a, b) => a - b)
  }

  const visiblePages = getVisiblePages()
  const showEllipsisBefore = visiblePages.length > 0 && visiblePages[0] === 1 && visiblePages[1] > 2
  const showEllipsisAfter =
    visiblePages.length > 0 &&
    visiblePages[visiblePages.length - 1] === totalPages &&
    visiblePages[visiblePages.length - 2] < totalPages - 1

  return (
    <div className={`flex w-full items-center justify-between gap-4 py-4 ${className || ''}`}>
      {/* Rows per page selector (Left) */}
      <div className="flex items-center gap-2">
        <span className="text-dark-500 text-sm font-light">Rows per page:</span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => {
            onPageSizeChange(Number(value))
            // Reset to first page when changing page size
            onPageChange(1)
          }}
        >
          <SelectTrigger className="h-auto w-auto min-w-[60px] border-0 bg-transparent p-0 shadow-none focus:ring-0">
            <SelectValue className="text-dark-500 text-sm font-medium" />
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

      {/* Pagination controls (Center) */}
      <div className="flex items-center gap-2">
        {/* Previous Arrow */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          aria-label="Previous page"
        >
          <Icons.ArrowLeft size={16} className="text-dark-500" strokeWidth={1.5} />
        </button>

        {/* First page */}
        {visiblePages[0] === 1 && (
          <button
            onClick={() => onPageChange(1)}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              currentPage === 1
                ? 'bg-secondary-800 text-white'
                : 'text-dark-500 border border-gray-300 bg-white hover:bg-gray-100'
            }`}
            aria-label="Go to page 1"
            aria-current={currentPage === 1 ? 'page' : undefined}
          >
            1
          </button>
        )}

        {/* Ellipsis before */}
        {showEllipsisBefore && (
          <button
            className="text-dark-500 flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-medium"
            disabled
            aria-label="More pages"
          >
            --
          </button>
        )}

        {/* Middle pages (excluding first and last if they're already shown) */}
        {visiblePages
          .filter((page) => page !== 1 && page !== totalPages)
          .map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-secondary-800 text-white'
                  : 'text-dark-500 border border-gray-300 bg-white hover:bg-gray-100'
              }`}
              aria-label={`Go to page ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          ))}

        {/* Ellipsis after */}
        {showEllipsisAfter && (
          <button
            className="text-dark-500 flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-medium"
            disabled
            aria-label="More pages"
          >
            --
          </button>
        )}

        {/* Last page */}
        {visiblePages[visiblePages.length - 1] === totalPages && totalPages !== 1 && (
          <button
            onClick={() => onPageChange(totalPages)}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
              currentPage === totalPages
                ? 'bg-secondary-800 text-white'
                : 'text-dark-500 border border-gray-300 bg-white hover:bg-gray-100'
            }`}
            aria-label={`Go to page ${totalPages}`}
            aria-current={currentPage === totalPages ? 'page' : undefined}
          >
            {totalPages}
          </button>
        )}

        {/* Next Arrow */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          aria-label="Next page"
        >
          <Icons.ArrowRight size={16} className="text-dark-500" strokeWidth={1.5} />
        </button>
      </div>

      {/* Page indicator (Right) */}
      <div className="flex items-center gap-1">
        <span className="text-sm font-light text-gray-700">Page</span>
        <span className="text-dark-500 text-sm font-medium">{currentPage}</span>
        <span className="text-sm font-light text-gray-500">of</span>
        <span className="text-dark-500 text-sm font-medium">{totalPages}</span>
      </div>
    </div>
  )
}

export default Pagination
