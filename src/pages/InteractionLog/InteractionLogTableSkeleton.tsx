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
        'data-table-scroll overflow-x-auto rounded-xl border border-[#EBECE8] bg-[#EBECE8] pb-2 shadow-sm',
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
            <tr className="bg-white">
              {headers.map((label, index) => (
                <th
                  key={columnKeys[index]}
                  scope="col"
                  className={cn(
                    'h-[49px] border-b border-[#EBECE8] bg-white px-4 text-left text-xs font-semibold text-[#05040D]',
                    index < headers.length - 1 && 'border-r border-[#EBECE8]'
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'}>
                {headers.map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className={cn(
                      'h-[49px] px-4',
                      colIndex < headers.length - 1 && 'border-r border-[#EBECE8]'
                    )}
                  >
                    <div className="h-4 w-full max-w-full animate-pulse rounded bg-gray-200" />
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
