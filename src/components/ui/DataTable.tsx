/**
 * DataTable Component
 *
 * Reusable data table component with light theme styling.
 * Matches the design specification with light gray header and white rows.
 */

import { type ReactNode } from 'react'

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  onRowClick?: (item: T) => void
  className?: string
}

export function DataTable<T extends { id: number | string }>({
  columns,
  data,
  emptyMessage = 'No data found',
  onRowClick,
  className,
}: DataTableProps<T>) {
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
            {columns.map((column, index) => (
              <th
                key={column.key}
                scope="col"
                className={`px-6 font-medium ${
                  column.align === 'center'
                    ? 'text-center'
                    : column.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                }`}
                style={{
                  height: '49px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#05040D',
                  borderRight: index < columns.length - 1 ? '1px solid #EBECE8' : 'none',
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-6 text-center font-medium"
                style={{
                  height: '49px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#05040D',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, rowIndex) => (
              <tr
                key={item.id}
                className={`transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                style={{
                  backgroundColor: rowIndex % 2 === 0 ? '#F2F3F0' : '#FFFFFF', // Changed zebra order: first row is #F2F3F0
                }}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={column.key}
                    className={`px-6 font-medium ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    } ${column.className || ''}`}
                    style={{
                      height: '49px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: '#05040D',
                      borderRight: colIndex < columns.length - 1 ? '1px solid #EBECE8' : 'none',
                    }}
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
