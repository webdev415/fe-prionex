/**
 * DataTable Component
 *
 * Reusable data table component with light theme styling.
 * Matches the design specification with light gray header and white rows.
 * Supports sortable columns with visual indicators.
 */

import { type ReactNode } from 'react'
import { Icons } from '@/lib/icons'

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
  sortable?: boolean
  sortKey?: string // Optional different key for sorting (e.g., 'name' column might sort by 'name' field)
}

export type SortOrder = 'asc' | 'desc'

export interface SortConfig {
  key: string
  order: SortOrder
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  onRowClick?: (item: T) => void
  className?: string
  sortConfig?: SortConfig
  onSort?: (key: string, order: SortOrder) => void
}

export function DataTable<T extends { id: number | string }>({
  columns,
  data,
  emptyMessage = 'No data found',
  onRowClick,
  className,
  sortConfig,
  onSort,
}: DataTableProps<T>) {
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return

    const sortKey = column.sortKey || column.key
    const newOrder: SortOrder =
      sortConfig?.key === sortKey && sortConfig.order === 'asc' ? 'desc' : 'asc'

    onSort(sortKey, newOrder)
  }

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null

    const sortKey = column.sortKey || column.key
    const isActive = sortConfig?.key === sortKey

    if (!isActive) {
      return (
        <span className="ml-1 opacity-40">
          <Icons.Sorting01Icon size={14} color="#6B7280" strokeWidth={1.5} />
        </span>
      )
    }

    return sortConfig.order === 'asc' ? (
      <span className="ml-1 inline-block rotate-180">
        <Icons.Sorting01Icon size={14} color="#0CA8EB" strokeWidth={2} />
      </span>
    ) : (
      <span className="ml-1">
        <Icons.Sorting01Icon size={14} color="#0CA8EB" strokeWidth={2} />
      </span>
    )
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-[#EBECE8] bg-[#EBECE8] shadow-sm ${className || ''}`}
    >
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-white">
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                className={`h-[49px] px-6 text-xs font-medium text-[#05040D] ${
                  column.align === 'center'
                    ? 'text-center'
                    : column.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                } ${column.sortable ? 'cursor-pointer select-none hover:bg-gray-50' : ''} ${
                  index < columns.length - 1 ? 'border-r border-[#EBECE8]' : ''
                }`}
                onClick={() => handleSort(column)}
              >
                <span className="inline-flex items-center">
                  {column.header}
                  {getSortIcon(column)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="h-[49px] px-6 text-center text-xs font-medium text-[#05040D]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, rowIndex) => (
              <tr
                key={item.id}
                className={`transition-colors ${
                  rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'
                } ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={column.key}
                    className={`text-dark-950 h-[49px] px-6 text-xs font-medium ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    } ${colIndex < columns.length - 1 ? 'border-r border-[#EBECE8]' : ''} ${column.className || ''}`}
                  >
                    {column.render
                      ? column.render(item)
                      : String((item as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
