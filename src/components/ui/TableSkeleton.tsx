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
}

export function TableSkeleton({ columns, rows = 5, className }: TableSkeletonProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl ${className || ''}`}
      style={{
        border: '1px solid #EBECE8',
        backgroundColor: '#EBECE8',
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
      }}
    >
      <table className="min-w-full border-collapse">
        <thead>
          <tr style={{ backgroundColor: '#FFFFFF' }}>
            {Array.from({ length: columns }).map((_, index) => (
              <th
                key={index}
                scope="col"
                className="px-6 font-medium"
                style={{
                  height: '49px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#05040D',
                  borderRight: index < columns - 1 ? '1px solid #EBECE8' : 'none',
                }}
              >
                <div
                  className="h-4 w-20 animate-pulse rounded"
                  style={{
                    backgroundColor: '#E5E7EB',
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              style={{
                backgroundColor: rowIndex % 2 === 0 ? '#F2F3F0' : '#FFFFFF',
              }}
            >
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td
                  key={colIndex}
                  className="px-6"
                  style={{
                    height: '49px',
                    borderRight: colIndex < columns - 1 ? '1px solid #EBECE8' : 'none',
                  }}
                >
                  <div
                    className="h-4 animate-pulse rounded"
                    style={{
                      backgroundColor: '#E5E7EB',
                      width: colIndex === 0 ? '60%' : colIndex === columns - 1 ? '40%' : '80%',
                    }}
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
