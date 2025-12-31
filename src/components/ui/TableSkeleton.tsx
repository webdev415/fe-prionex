/**
 * TableSkeleton Component
 *
 * Reusable skeleton loading component for data tables.
 * Matches the DataTable structure with animated placeholders.
 */

export interface TableSkeletonProps {
  /** Number of columns to display */
  columns: number
  /** Number of skeleton rows to display (default: 5) */
  rows?: number
  /** Custom className for the container */
  className?: string
  /** Enable bulk selection checkbox column */
  enableBulkSelection?: boolean
  /** Show bulk header row skeleton */
  showBulkHeader?: boolean
  /** Show table header actions row skeleton */
  showTableHeaderActions?: boolean
}

export function TableSkeleton({
  columns,
  rows = 5,
  className,
  enableBulkSelection = false,
  showBulkHeader = false,
  showTableHeaderActions = false,
}: TableSkeletonProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm ${className || ''}`}
    >
      {/* Bulk Header Row Skeleton */}
      {showBulkHeader && (
        <div className="flex h-[49px] items-center justify-between border-b border-[#EBECE8] bg-white px-6">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        </div>
      )}

      {/* Table Header Actions Row Skeleton */}
      {showTableHeaderActions && (
        <div className="flex h-[49px] items-center justify-between border-b border-[#EBECE8] bg-white px-6">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-40 animate-pulse rounded bg-gray-200" />
        </div>
      )}

      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-white">
            {/* Checkbox column for bulk selection */}
            {enableBulkSelection && (
              <th
                scope="col"
                className="h-[49px] border-r border-[#EBECE8] px-6 text-xs font-medium text-[#05040D]"
              >
                <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
              </th>
            )}
            {Array.from({ length: columns }).map((_, index) => (
              <th
                key={index}
                scope="col"
                className={`h-[49px] px-6 text-xs font-medium text-[#05040D] ${index < columns - 1 ? 'border-r border-[#EBECE8]' : ''}`}
              >
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}>
              {/* Checkbox column for bulk selection */}
              {enableBulkSelection && (
                <td className="h-[49px] border-r border-[#EBECE8] px-6">
                  <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                </td>
              )}
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td
                  key={colIndex}
                  className={`h-[49px] px-6 ${colIndex < columns - 1 ? 'border-r border-[#EBECE8]' : ''}`}
                >
                  <div
                    className={`h-4 animate-pulse rounded bg-gray-200 ${
                      colIndex === 0 ? 'w-[60%]' : colIndex === columns - 1 ? 'w-[40%]' : 'w-[80%]'
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default TableSkeleton
