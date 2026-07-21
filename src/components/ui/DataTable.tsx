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

import { Fragment, type ReactNode, useMemo, useRef, useEffect, useState } from 'react'
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
  tableClassName?: string // Additional classes for the <table> element (e.g., 'table-fixed')
  /** Extra row classes (e.g. dim hidden rows). Applied after selection / zebra background. */
  rowClassName?: (item: T) => string | undefined
  /**
   * Optional renderer for an expansion panel below a row. Returns the
   * content to display in a full-width row beneath the data row. Rendered
   * only when ``expandedIds`` contains the row's id. Multi-row expand is
   * supported — supply more than one id.
   *
   * Backwards-compatible: existing DataTable consumers that don't pass
   * ``renderExpanded`` are unaffected.
   */
  renderExpanded?: (item: T) => ReactNode
  /** Set of row IDs currently expanded. Controlled prop — parent owns the state. */
  expandedIds?: Set<number | string>
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
  tableClassName,
  rowClassName,
  renderExpanded,
  expandedIds,
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

    // In all-selected mode, `selectedItems` only holds the ids of the page where
    // "Select All" was clicked — it does NOT contain the rows of other pages, even
    // though those rows render as checked (from `allItemsSelected`). Building the
    // new selection from `selectedItems` here would therefore send the parent a set
    // with no ids for the current page, which the parent reads as "every row on this
    // page is excluded" — silently dropping the whole page from the selection.
    //
    // Instead, derive the new selection from the rows the user actually sees checked
    // on the current page (all `data` rows that aren't excluded), then apply the
    // toggle. This lets the parent correctly recompute exclusions for the page being
    // edited, regardless of which page "Select All" was originally clicked on.
    if (allItemsSelected) {
      const newSelection = new Set(
        data.filter((item) => !excludedItems.has(item.id)).map((item) => item.id)
      )
      if (checked) {
        newSelection.add(itemId)
      } else {
        newSelection.delete(itemId)
      }
      onSelectionChange(newSelection)
      return
    }

    const newSelection = new Set(selectedItems)
    if (checked) {
      newSelection.add(itemId)
    } else {
      newSelection.delete(itemId)
    }
    onSelectionChange(newSelection)
  }

  // Header checkbox state in all-selected mode must reflect *global* selection, not just
  // the current page. Otherwise a page with no local exclusions still shows a full check
  // while the count reads "Selected N-1 of N" after the user unchecked a row elsewhere.
  const allSelected = useMemo(() => {
    if (allItemsSelected) {
      if (data.length === 0) return false
      const allOnPageSelected = data.every((item) => !excludedItems.has(item.id))
      return excludedItemsCount === 0 && allOnPageSelected
    }
    // All-pages mode (onSelectAll provided): manually selecting a page's rows must
    // NOT tick the header — that's reserved for the explicit "select all" action.
    if (onSelectAll) return false
    // Simple controlled mode (selectedItems + onSelectionChange): the header reflects
    // the visible selection, so it ticks once every row on the page is selected.
    return data.length > 0 && data.every((item) => selectedItems.has(item.id))
  }, [data, allItemsSelected, excludedItems, excludedItemsCount, onSelectAll, selectedItems])

  const someSelected = useMemo(() => {
    if (allItemsSelected) {
      if (data.length === 0) return false
      const excludedOnPage = data.filter((item) => excludedItems.has(item.id)).length
      const partialOnPage = excludedOnPage > 0 && excludedOnPage < data.length
      const globalPartial = excludedItemsCount > 0
      return globalPartial || partialOnPage
    }
    return selectedItems.size > 0 && selectedItems.size < data.length
  }, [selectedItems, data, allItemsSelected, excludedItems, excludedItemsCount])

  const headerCheckboxChecked = allSelected

  const hasSelectedItems = selectedItems.size > 0

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null

    const sortKey = column.sortKey || column.key
    const isActive = sortConfig?.key === sortKey

    if (!isActive) {
      return (
        <span className="ml-1 opacity-40">
          <Icons.Sorting01Icon size={14} className="text-muted-foreground" strokeWidth={1.5} />
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
      <span className="text-foreground text-xs font-medium">
        {t('common.selected', 'Selected')} {selectedCount} {t('common.of', 'of')} {totalItems}
      </span>
    )
  }

  // Render bulk header title
  const renderBulkHeaderTitle = () => {
    if (bulkHeaderTitle) {
      return typeof bulkHeaderTitle === 'string' ? (
        <span className="text-foreground text-xs font-medium">{bulkHeaderTitle}</span>
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
      className={`data-table-scroll border-border bg-border overflow-x-auto rounded-xl border pb-2 shadow-sm ${className || ''}`}
    >
      <div className="min-w-full">
        {/* Header Row - shown when bulk selection is enabled OR when tableHeaderActions/tableHeaderTitle is provided */}
        {showHeaderRow && (
          <div
            ref={headerRowRef}
            className="border-border bg-card top-0 z-20 flex min-h-[49px] w-full items-center justify-between border-b px-4 shadow-sm"
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
                  <span className="text-foreground text-xs font-medium">{tableHeaderTitle}</span>
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

        <table className={`min-w-full border-collapse ${tableClassName || 'whitespace-nowrap'}`}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-card">
              {/* Checkbox column for bulk selection */}
              {enableBulkSelection && (
                <th
                  scope="col"
                  style={{ height: `${headerHeight}px` }}
                  className="border-border bg-card w-[60px] border-r border-b px-4 text-left"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={headerCheckboxChecked}
                    onCheckedChange={handleSelectAll}
                    aria-checked={someSelected ? 'mixed' : headerCheckboxChecked}
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{ height: `${headerHeight}px` }}
                  className={`border-border bg-card border-b px-4 text-xs font-semibold ${column.className ? '' : 'whitespace-nowrap'} text-foreground ${
                    column.align === 'center'
                      ? 'text-center'
                      : column.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                  } ${column.sortable ? 'hover:bg-muted cursor-pointer transition-colors select-none' : ''} ${
                    index < columns.length - 1 ? 'border-border border-r' : ''
                  } ${column.className || ''}`}
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
                  className="text-foreground h-[49px] px-4 text-center text-xs font-medium"
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
                  return rowIndex % 2 === 0 ? 'bg-muted' : 'bg-card'
                }
                const isExpanded = !!(renderExpanded && expandedIds?.has(item.id))
                return (
                  <Fragment key={item.id}>
                    <tr
                      className={`transition-colors ${getRowBackground()} ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(item) ?? ''}`}
                      onClick={() => onRowClick?.(item)}
                    >
                      {/* Checkbox column for bulk selection */}
                      {enableBulkSelection && (
                        <td
                          className="border-border h-[49px] border-r px-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelectItem(item.id, checked === true)
                            }
                            aria-label={`Select item ${item.id}`}
                          />
                        </td>
                      )}
                      {columns.map((column, colIndex) => (
                        <td
                          key={column.key}
                          className={`text-foreground h-[49px] px-4 text-xs font-medium ${column.className ? '' : 'whitespace-nowrap'} ${
                            column.align === 'center'
                              ? 'text-center'
                              : column.align === 'right'
                                ? 'text-right'
                                : 'text-left'
                          } ${colIndex < columns.length - 1 ? 'border-border border-r' : ''} ${column.className || ''}`}
                        >
                          {column.render
                            ? column.render(item)
                            : String((item as Record<string, unknown>)[column.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted">
                        <td
                          colSpan={columns.length + (enableBulkSelection ? 1 : 0)}
                          className="px-4 py-3"
                        >
                          {renderExpanded!(item)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
