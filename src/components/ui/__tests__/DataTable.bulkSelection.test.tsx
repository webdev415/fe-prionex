/**
 * Regression tests for bulk "Select All" selection across paginated pages.
 *
 * Ticket: [HIGH] Bulk-selection in "Select All" mode breaks on every page
 * except the one where Select All was clicked — unchecking a single row
 * excluded the entire page.
 *
 * Root cause: in all-selected mode `DataTable.handleSelectItem` rebuilt the
 * emitted selection from the `selectedItems` prop, which only holds the ids of
 * the page where "Select All" was clicked. On any other page that set contained
 * none of the visible rows, so the parent (which derives the per-page exclusions
 * from the emitted set) treated *every* row of the current page as unchecked.
 *
 * The fix derives the emitted selection from the rows actually rendered checked
 * on the current page (`data` minus `excludedItems`), so the parent receives an
 * accurate per-page snapshot regardless of where Select All originated.
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { DataTable, type Column } from '../DataTable'

interface Row {
  id: number
  name: string
}

const columns: Column<Row>[] = [{ key: 'name', header: 'Name', render: (r) => r.name }]

// Page 1 ids — these are what the parent keeps in `selectedClients` after the
// user clicks "Select All" on page 1 (handleSelectAll stores only currentPageIds).
const PAGE_1_IDS = [1, 2, 3]
// Page 2 rows — the page the user navigates to *after* clicking Select All.
const PAGE_2: Row[] = [
  { id: 11, name: 'Row 11' },
  { id: 12, name: 'Row 12' },
  { id: 13, name: 'Row 13' },
]

/**
 * Mirrors how `ClientManagementPage.handleSelectionChange` turns the set emitted
 * by DataTable into the set of ids excluded from an all-selected operation.
 * Used to prove the end-to-end effect: a correct emit excludes ONLY the toggled
 * row, the buggy emit excluded the whole page.
 */
function excludedFromEmit(emitted: Set<number | string>, currentPage: Row[]): number[] {
  return currentPage.filter((row) => !emitted.has(row.id)).map((row) => row.id)
}

describe('DataTable bulk selection across pages (Select All mode)', () => {
  it('unchecking one row on a non-origin page excludes only that row, not the whole page', () => {
    const onSelectionChange = vi.fn<(s: Set<number | string>) => void>()

    render(
      <DataTable
        columns={columns}
        data={PAGE_2}
        enableBulkSelection
        // Parent still holds page-1 ids after Select All — the crux of the bug.
        selectedItems={new Set(PAGE_1_IDS)}
        allItemsSelected
        excludedItems={new Set()}
        onSelectionChange={onSelectionChange}
        onSelectAll={vi.fn()}
        totalCount={14060}
      />
    )

    // All page-2 rows render checked from `allItemsSelected`.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select item 12' }))

    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    const emitted = onSelectionChange.mock.calls[0][0]

    // The emit must reflect the *current page's* checked rows (11 & 13 stay
    // checked, 12 toggled off) — NOT the stale page-1 ids.
    expect(emitted).toEqual(new Set([11, 13]))

    // End-to-end: the parent would exclude only row 12, not the entire page.
    expect(excludedFromEmit(emitted, PAGE_2)).toEqual([12])
  })

  it('re-checking a previously excluded row on a non-origin page clears just that exclusion', () => {
    const onSelectionChange = vi.fn<(s: Set<number | string>) => void>()

    render(
      <DataTable
        columns={columns}
        data={PAGE_2}
        enableBulkSelection
        selectedItems={new Set(PAGE_1_IDS)}
        allItemsSelected
        excludedItems={new Set([12])}
        onSelectionChange={onSelectionChange}
        onSelectAll={vi.fn()}
        totalCount={14060}
      />
    )

    // Row 12 is currently excluded (rendered unchecked); re-check it.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select item 12' }))

    const emitted = onSelectionChange.mock.calls[0][0]
    // Whole page is now checked again → parent clears the exclusion for 12.
    expect(emitted).toEqual(new Set([11, 12, 13]))
    expect(excludedFromEmit(emitted, PAGE_2)).toEqual([])
  })

  it('shows unchecked header (same as row checkboxes) when global exclusions exist', () => {
    render(
      <DataTable
        columns={columns}
        data={PAGE_2}
        enableBulkSelection
        selectedItems={new Set(PAGE_1_IDS)}
        allItemsSelected
        excludedItems={new Set()}
        excludedItemsCount={1}
        onSelectionChange={vi.fn()}
        onSelectAll={vi.fn()}
        totalCount={14060}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'data-state',
      'unchecked'
    )
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'aria-checked',
      'mixed'
    )
  })

  it('shows checked header only when there are no exclusions anywhere', () => {
    render(
      <DataTable
        columns={columns}
        data={PAGE_2}
        enableBulkSelection
        selectedItems={new Set(PAGE_1_IDS)}
        allItemsSelected
        excludedItems={new Set()}
        excludedItemsCount={0}
        onSelectionChange={vi.fn()}
        onSelectAll={vi.fn()}
        totalCount={14060}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'data-state',
      'checked'
    )
  })

  it('shows unchecked header when current page has a local exclusion', () => {
    render(
      <DataTable
        columns={columns}
        data={PAGE_2}
        enableBulkSelection
        selectedItems={new Set([11, 13])}
        allItemsSelected
        excludedItems={new Set([12])}
        excludedItemsCount={1}
        onSelectionChange={vi.fn()}
        onSelectAll={vi.fn()}
        totalCount={14060}
      />
    )

    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'data-state',
      'unchecked'
    )
    expect(screen.getByRole('checkbox', { name: 'Select all' })).toHaveAttribute(
      'aria-checked',
      'mixed'
    )
  })

  it('normal (non all-selected) selection still toggles via the provided set', () => {
    const onSelectionChange = vi.fn<(s: Set<number | string>) => void>()

    const { rerender } = render(
      <DataTable
        columns={columns}
        data={PAGE_2}
        enableBulkSelection
        selectedItems={new Set([11])}
        allItemsSelected={false}
        onSelectionChange={onSelectionChange}
      />
    )

    // Adding a row keeps the existing manual selection.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select item 12' }))
    expect(onSelectionChange.mock.calls[0][0]).toEqual(new Set([11, 12]))

    rerender(
      <DataTable
        columns={columns}
        data={PAGE_2}
        enableBulkSelection
        selectedItems={new Set([11, 12])}
        allItemsSelected={false}
        onSelectionChange={onSelectionChange}
      />
    )

    // Removing a row drops just that id.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select item 11' }))
    expect(onSelectionChange.mock.calls[1][0]).toEqual(new Set([12]))
  })
})
