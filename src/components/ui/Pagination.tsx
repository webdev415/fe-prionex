/**
 * Pagination Component
 *
 * Reusable pagination component for navigating through paginated data.
 * Supports previous/next navigation, page numbers, and ellipsis for large page counts.
 */

import { Icons } from '@/lib/icons'

export interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Callback when page changes */
  onPageChange: (page: number) => void
  /** Custom className for the container */
  className?: string
}

export function Pagination({ currentPage, totalPages, onPageChange, className }: PaginationProps) {
  // Generate visible page numbers (max 4 pages)
  const getVisiblePages = () => {
    if (totalPages <= 4) {
      // Show all pages if 4 or fewer
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
    <div className={`mt-6 flex items-center justify-center gap-2 ${className || ''}`}>
      {/* Previous Arrow */}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
        aria-label="Previous page"
      >
        <Icons.ArrowLeft size={16} color="#1A1A1A" strokeWidth={1.5} />
      </button>

      {/* First page */}
      {visiblePages[0] === 1 && (
        <button
          onClick={() => onPageChange(1)}
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
            currentPage === 1
              ? 'bg-secondary-800 text-white'
              : 'text-dark-950 border border-gray-300 bg-white hover:bg-gray-100'
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
          className="text-dark-950 flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-medium"
          disabled
          aria-label="More pages"
        >
          ...
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
                : 'text-dark-950 border border-gray-300 bg-white hover:bg-gray-100'
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
          className="text-dark-950 flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-medium"
          disabled
          aria-label="More pages"
        >
          ...
        </button>
      )}

      {/* Last page */}
      {visiblePages[visiblePages.length - 1] === totalPages && totalPages !== 1 && (
        <button
          onClick={() => onPageChange(totalPages)}
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors ${
            currentPage === totalPages
              ? 'bg-secondary-800 text-white'
              : 'text-dark-950 border border-gray-300 bg-white hover:bg-gray-100'
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
        <Icons.ArrowRight size={16} color="#1A1A1A" strokeWidth={1.5} />
      </button>
    </div>
  )
}

export default Pagination
