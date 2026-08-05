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
      className={`border-border bg-card animate-pulse overflow-hidden rounded-xl border shadow-sm [will-change:opacity] ${className || ''}`}
    >
      {showBulkHeader && (
        <div className="border-border bg-card flex h-[49px] items-center justify-between border-b px-6">
          <div className="bg-muted h-4 w-24 rounded" />
          <div className="bg-muted h-8 w-32 rounded" />
        </div>
      )}

      {showTableHeaderActions && (
        <div className="border-border bg-card flex h-[49px] items-center justify-between border-b px-6">
          <div className="bg-muted h-4 w-32 rounded" />
          <div className="bg-muted h-8 w-40 rounded" />
        </div>
      )}

      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-muted/60">
            {enableBulkSelection && (
              <th scope="col" className="border-border h-[49px] border-r px-6 text-left">
                <div className="bg-muted h-4 w-4 rounded" />
              </th>
            )}
            {Array.from({ length: columns }).map((_, index) => (
              <th
                key={index}
                scope="col"
                className={`h-[49px] px-6 ${index < columns - 1 ? 'border-border border-r' : ''}`}
              >
                <div className="bg-muted h-4 w-20 rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="bg-card">
              {enableBulkSelection && (
                <td className="border-border h-[49px] border-r px-6">
                  <div className="bg-muted h-4 w-4 rounded" />
                </td>
              )}
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td
                  key={colIndex}
                  className={`h-[49px] px-6 ${colIndex < columns - 1 ? 'border-border border-r' : ''}`}
                >
                  <div
                    className={`bg-muted h-4 rounded ${
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
