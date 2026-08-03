/**
 * Loading skeleton for the Interaction Log data table.
 * Matches DataTable layout (borders, row striping, header row) and uses the same
 * column headers as the loaded table so the transition feels consistent.
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface InteractionLogTableSkeletonProps {
  /** Skeleton body rows (default 8) */
  rows?: number
  className?: string
}

const COL_WIDTHS_PCT = [15, 8, 18, 24, 9, 14, 12] as const

export function InteractionLogTableSkeleton({
  rows = 8,
  className,
}: InteractionLogTableSkeletonProps) {
  const { t } = useTranslation('common')

  const columnKeys = [
    'pages.interactionLog.columns.date',
    'pages.interactionLog.columns.clientId',
    'pages.interactionLog.columns.chain',
    'pages.interactionLog.columns.dictionaryPath',
    'pages.interactionLog.columns.creditNumber',
    'pages.interactionLog.columns.notes',
    'pages.interactionLog.columns.operator',
  ] as const

  const headers = columnKeys.map((key) => t(key))

  return (
    <div
      className={cn(
        'data-table-scroll border-border bg-border overflow-x-auto rounded-xl border pb-2 shadow-sm',
        className
      )}
    >
      <div className="min-w-full">
        <table className="w-full min-w-full table-fixed border-collapse whitespace-nowrap">
          <colgroup>
            {COL_WIDTHS_PCT.map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="bg-card">
              {headers.map((label, index) => (
                <th
                  key={columnKeys[index]}
                  scope="col"
                  className={cn(
                    'border-border bg-card text-foreground h-[49px] border-b px-4 text-left text-xs font-semibold',
                    index < headers.length - 1 && 'border-border border-r'
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-muted' : 'bg-card'}>
                {headers.map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className={cn(
                      'h-[49px] px-4',
                      colIndex < headers.length - 1 && 'border-border border-r'
                    )}
                  >
                    <div className="bg-muted-foreground/25 h-4 w-full max-w-full animate-pulse rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
