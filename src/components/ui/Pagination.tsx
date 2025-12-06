/**
 * Pagination Component
 *
 * Reusable pagination component for navigating through paginated data.
 * Supports previous/next navigation, page numbers, and ellipsis for large page counts.
 */

import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'

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

  // Don't show pagination if there's only 1 page or less
  if (totalPages <= 1) {
    return null
  }

  return (
    <div className={`mt-6 flex items-center justify-center gap-2 ${className || ''}`}>
      {/* Previous Arrow */}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex h-10 w-10 items-center justify-center rounded-full border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: colors.gray[300],
        }}
        onMouseEnter={(e) => {
          if (currentPage !== 1) {
            e.currentTarget.style.backgroundColor = colors.gray[100]
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#FFFFFF'
        }}
        aria-label="Previous page"
      >
        <Icons.ArrowLeft size={16} color={colors.neutral.dark[500]} strokeWidth={1.5} />
      </button>

      {/* First page */}
      {visiblePages[0] === 1 && (
        <button
          onClick={() => onPageChange(1)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors"
          style={{
            backgroundColor: currentPage === 1 ? colors.secondary[800] : '#FFFFFF',
            color: currentPage === 1 ? '#FFFFFF' : colors.neutral.dark[500],
            border: currentPage === 1 ? 'none' : `1px solid ${colors.gray[300]}`,
          }}
          onMouseEnter={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.backgroundColor = colors.gray[100]
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== 1) {
              e.currentTarget.style.backgroundColor = '#FFFFFF'
            }
          }}
          aria-label="Go to page 1"
          aria-current={currentPage === 1 ? 'page' : undefined}
        >
          1
        </button>
      )}

      {/* Ellipsis before */}
      {showEllipsisBefore && (
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-white text-sm font-medium"
          style={{
            borderColor: colors.gray[300],
            color: colors.neutral.dark[500],
          }}
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
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors"
            style={{
              backgroundColor: currentPage === page ? colors.secondary[800] : '#FFFFFF',
              color: currentPage === page ? '#FFFFFF' : colors.neutral.dark[500],
              border: currentPage === page ? 'none' : `1px solid ${colors.gray[300]}`,
            }}
            onMouseEnter={(e) => {
              if (currentPage !== page) {
                e.currentTarget.style.backgroundColor = colors.gray[100]
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== page) {
                e.currentTarget.style.backgroundColor = '#FFFFFF'
              }
            }}
            aria-label={`Go to page ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
          >
            {page}
          </button>
        ))}

      {/* Ellipsis after */}
      {showEllipsisAfter && (
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-white text-sm font-medium"
          style={{
            borderColor: colors.gray[300],
            color: colors.neutral.dark[500],
          }}
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
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors"
          style={{
            backgroundColor: currentPage === totalPages ? colors.secondary[800] : '#FFFFFF',
            color: currentPage === totalPages ? '#FFFFFF' : colors.neutral.dark[500],
            border: currentPage === totalPages ? 'none' : `1px solid ${colors.gray[300]}`,
          }}
          onMouseEnter={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.backgroundColor = colors.gray[100]
            }
          }}
          onMouseLeave={(e) => {
            if (currentPage !== totalPages) {
              e.currentTarget.style.backgroundColor = '#FFFFFF'
            }
          }}
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
        className="flex h-10 w-10 items-center justify-center rounded-full border bg-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          borderColor: colors.gray[300],
        }}
        onMouseEnter={(e) => {
          if (currentPage !== totalPages) {
            e.currentTarget.style.backgroundColor = colors.gray[100]
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#FFFFFF'
        }}
        aria-label="Next page"
      >
        <Icons.ArrowRight size={16} color={colors.neutral.dark[500]} strokeWidth={1.5} />
      </button>
    </div>
  )
}

export default Pagination
