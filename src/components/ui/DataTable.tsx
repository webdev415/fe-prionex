/**
 * DataTable Component
 *
 * Reusable data table component with light theme styling.
 * Matches the design specification with light gray header and white rows.
 * Supports sortable columns with visual indicators.
 * Supports bulk selection with checkboxes and custom header actions.
 *
 * Bulk Selection Features:
 * - enableBulkSelection: Enable bulk selection mode
 * - bulkHeaderTitle: Custom title for the bulk actions header (e.g., "[Bulk Assign]")
 * - bulkHeaderActions: Buttons/actions always visible in the bulk header (right side) - allows developers to insert buttons
 * - headerActions: Actions shown only when items are selected (for backward compatibility)
 * - selectedItems: Set of selected item IDs
 * - onSelectionChange: Callback when selection changes
 * - totalCount: Total count of all items (for pagination scenarios). If not provided, uses data.length
 * - Automatically displays "Selected X of Y" (always visible, shows "Selected 0 of Y" when no items selected)
 *
 * Table Header Actions (without bulk selection):
 * - tableHeaderActions: Buttons/actions to display in a header row above the table (works independently of bulk selection)
 * - tableHeaderTitle: Optional title/text to display on the left side of the table header
 */

import { type ReactNode, useMemo, useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Checkbox } from './Checkbox'

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
  // Bulk selection props
  enableBulkSelection?: boolean
  selectedItems?: Set<number | string>
  onSelectionChange?: (selectedItems: Set<number | string>) => void
  totalCount?: number // Total count of all items (for pagination scenarios). If not provided, uses data.length
  onSelectAll?: () => void // Callback when "select all" is clicked. If provided, will be called instead of selecting current page items
  allItemsSelected?: boolean // Indicates if all items across all pages are selected (when onSelectAll is used)
  excludedItemsCount?: number // Number of excluded items when allItemsSelected is true (for accurate count)
  excludedItems?: Set<number | string> // Set of excluded item IDs when allItemsSelected is true
  // Bulk header configuration
  bulkHeaderTitle?: string | ReactNode // Custom title for bulk actions header (e.g., "[Bulk Assign]")
  bulkHeaderActions?: ReactNode // Buttons/actions to display in the bulk header (always visible when bulk selection is enabled)
  // Header actions (buttons/actions to display in the header when items are selected) - kept for backward compatibility
  headerActions?: ReactNode
  // Table header actions (works independently of bulk selection)
  tableHeaderActions?: ReactNode // Buttons/actions to display in a header row above the table
  tableHeaderTitle?: string | ReactNode // Optional title/text to display on the left side of the table header
}

export function DataTable<T extends { id: number | string }>({
  columns,
  data,
  emptyMessage = 'No data found',
  onRowClick,
  className,
  sortConfig,
  onSort,
  enableBulkSelection = false,
  selectedItems = new Set(),
  onSelectionChange,
  totalCount,
  onSelectAll,
  allItemsSelected = false,
  excludedItemsCount = 0,
  excludedItems = new Set(),
  bulkHeaderTitle,
  bulkHeaderActions,
  headerActions,
  tableHeaderActions,
  tableHeaderTitle,
}: DataTableProps<T>) {
  const { t } = useTranslation('common')
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return

    const sortKey = column.sortKey || column.key
    const newOrder: SortOrder =
      sortConfig?.key === sortKey && sortConfig.order === 'asc' ? 'desc' : 'asc'

    onSort(sortKey, newOrder)
  }

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // If onSelectAll callback is provided, use it (for selecting all items across all pages)
      if (onSelectAll) {
        onSelectAll()
        return
      }
      // Otherwise, select all items on current page
      if (onSelectionChange) {
        onSelectionChange(new Set(data.map((item) => item.id)))
      }
    } else {
      // Deselect all - clear everything
      if (onSelectionChange) {
        onSelectionChange(new Set())
      }
      // If allItemsSelected is true, we also need to clear it
      // This is handled by the parent component when it receives an empty set
    }
  }

  const handleSelectItem = (itemId: number | string, checked: boolean) => {
    if (!onSelectionChange) return

    // If unchecking an item when allItemsSelected is true, we need to clear the all-selected state
    // The parent component should handle this by clearing allItemsSelected flag
    const newSelection = new Set(selectedItems)
    if (checked) {
      newSelection.add(itemId)
    } else {
      newSelection.delete(itemId)
      // If all items were selected and we're unchecking one, the parent will clear all-selected state
    }
    onSelectionChange(newSelection)
  }

  // Check if all items are selected
  // Only return true when allItemsSelected is true (user clicked "Select All")
  // Don't auto-check when user manually selects all items on current page
  const allSelected = useMemo(() => {
    if (allItemsSelected) {
      // If all items are selected, check if any items on current page are excluded
      if (data.length === 0) return false
      return data.every((item) => !excludedItems.has(item.id))
    }
    // When allItemsSelected is false, don't check the header checkbox
    // even if all items on current page are manually selected
    return false
  }, [data, allItemsSelected, excludedItems])

  // Check if some items are selected
  const someSelected = useMemo(() => {
    if (allItemsSelected) {
      // If all items are selected, check if some (but not all) items on current page are excluded
      if (data.length === 0) return false
      const excludedOnPage = data.filter((item) => excludedItems.has(item.id)).length
      return excludedOnPage > 0 && excludedOnPage < data.length
    }
    return selectedItems.size > 0 && selectedItems.size < data.length
  }, [selectedItems, data, allItemsSelected, excludedItems])

  const hasSelectedItems = selectedItems.size > 0

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null

    const sortKey = column.sortKey || column.key
    const isActive = sortConfig?.key === sortKey

    if (!isActive) {
      return (
        <span className="ml-1 opacity-40">
          <Icons.Sorting01Icon size={14} className="text-gray-500" strokeWidth={1.5} />
        </span>
      )
    }

    return sortConfig.order === 'asc' ? (
      <span className="ml-1 inline-block rotate-180">
        <Icons.Sorting01Icon size={14} className="text-information-400" strokeWidth={2} />
      </span>
    ) : (
      <span className="ml-1">
        <Icons.Sorting01Icon size={14} className="text-information-400" strokeWidth={2} />
      </span>
    )
  }

  // Render bulk header selection info (e.g., "Selected X of Y") - always visible
  const renderBulkHeaderSelectionInfo = () => {
    // Use totalCount if provided (for pagination), otherwise use data.length (current page)
    const totalItems = totalCount !== undefined ? totalCount : data.length

    // Calculate selected count
    let selectedCount: number
    if (allItemsSelected) {
      // If all items are selected, subtract excluded items
      selectedCount = totalItems - excludedItemsCount
    } else {
      // Normal selection mode
      selectedCount = selectedItems.size
    }

    return (
      <span className="text-xs font-medium text-[#05040D]">
        {t('common.selected', 'Selected')} {selectedCount} {t('common.of', 'of')} {totalItems}
      </span>
    )
  }

  // Render bulk header title
  const renderBulkHeaderTitle = () => {
    if (bulkHeaderTitle) {
      return typeof bulkHeaderTitle === 'string' ? (
        <span className="text-xs font-medium text-[#05040D]">{bulkHeaderTitle}</span>
      ) : (
        bulkHeaderTitle
      )
    }
    return null
  }

  // Determine if we should show a header row
  const showHeaderRow = enableBulkSelection || tableHeaderActions || tableHeaderTitle

  // Measure header row height and sync with table header
  const headerRowRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState<number>(49) // Default 49px

  useEffect(() => {
    if (showHeaderRow && headerRowRef.current) {
      // Measure the actual height of the header row
      const height = headerRowRef.current.offsetHeight
      setHeaderHeight(height)
    } else if (!showHeaderRow) {
      // If no header row, use default height
      setHeaderHeight(49)
    }
  }, [showHeaderRow, bulkHeaderActions, tableHeaderActions, selectedItems.size, data.length])

  return (
    <div
      className={`data-table-scroll overflow-x-auto rounded-xl border border-[#EBECE8] bg-[#EBECE8] pb-2 shadow-sm ${className || ''}`}
    >
      <div className="min-w-full">
        {/* Header Row - shown when bulk selection is enabled OR when tableHeaderActions/tableHeaderTitle is provided */}
        {showHeaderRow && (
          <div
            ref={headerRowRef}
            className="sticky top-0 z-20 flex min-h-[49px] w-full items-center justify-between border-b border-[#EBECE8] bg-white px-4 shadow-sm"
          >
            <div className="flex w-full items-center gap-3">
              {/* Show selection info when bulk selection is enabled */}
              {enableBulkSelection && renderBulkHeaderSelectionInfo()}
              {/* Custom bulk header title */}
              {enableBulkSelection && renderBulkHeaderTitle()}
              {/* Table header title (when not using bulk selection) */}
              {!enableBulkSelection &&
                tableHeaderTitle &&
                (typeof tableHeaderTitle === 'string' ? (
                  <span className="text-xs font-medium text-[#05040D]">{tableHeaderTitle}</span>
                ) : (
                  tableHeaderTitle
                ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Bulk header actions (when bulk selection is enabled) */}
              {enableBulkSelection && bulkHeaderActions}
              {/* Actions shown only when items are selected (for backward compatibility) */}
              {enableBulkSelection && hasSelectedItems && headerActions}
              {/* Table header actions (works independently of bulk selection) */}
              {tableHeaderActions}
            </div>
          </div>
        )}

        <table className="min-w-full border-collapse whitespace-nowrap">
          <thead className="sticky top-0 z-10">
            <tr className="bg-white">
              {/* Checkbox column for bulk selection */}
              {enableBulkSelection && (
                <th
                  scope="col"
                  style={{ height: `${headerHeight}px` }}
                  className="w-[60px] border-r border-b border-[#EBECE8] bg-white px-4 text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className={someSelected ? 'opacity-50' : ''}
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{ height: `${headerHeight}px` }}
                  className={`border-b border-[#EBECE8] bg-white px-4 text-xs font-semibold whitespace-nowrap text-[#05040D] ${
                    column.align === 'center'
                      ? 'text-center'
                      : column.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                  } ${column.sortable ? 'cursor-pointer transition-colors select-none hover:bg-gray-50' : ''} ${
                    index < columns.length - 1 ? 'border-r border-[#EBECE8]' : ''
                  }`}
                  onClick={() => handleSort(column)}
                >
                  <span className="inline-flex items-center gap-1">
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
                  colSpan={enableBulkSelection ? columns.length + 1 : columns.length}
                  className="h-[49px] px-4 text-center text-xs font-medium text-[#05040D]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, rowIndex) => {
                // If allItemsSelected is true, treat all rows as selected EXCEPT excluded items
                const isExcluded = allItemsSelected && excludedItems.has(item.id)
                const isSelected =
                  (allItemsSelected && !isExcluded) ||
                  (!allItemsSelected && selectedItems.has(item.id))
                // Determine background color: selected rows get distinct color, others alternate
                const getRowBackground = () => {
                  if (isSelected) {
                    return 'bg-information-50' // Light blue background for selected rows
                  }
                  return rowIndex % 2 === 0 ? 'bg-[#F2F3F0]' : 'bg-white'
                }
                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${getRowBackground()} ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => onRowClick?.(item)}
                  >
                    {/* Checkbox column for bulk selection */}
                    {enableBulkSelection && (
                      <td
                        className="h-[49px] border-r border-[#EBECE8] px-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked === true)}
                          aria-label={`Select item ${item.id}`}
                        />
                      </td>
                    )}
                    {columns.map((column, colIndex) => (
                      <td
                        key={column.key}
                        className={`text-dark-500 h-[49px] px-4 text-xs font-medium whitespace-nowrap ${
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
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataTable
