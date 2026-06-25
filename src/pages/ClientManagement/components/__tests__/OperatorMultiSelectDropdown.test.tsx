/**
 * OperatorMultiSelectDropdown — KAN-607 special "null" option behaviour.
 *
 * Covers the special pinned option (e.g. "No Responsible" / "No Interactions"):
 *   - renders below the select-all row,
 *   - stays visible while the search box hides regular operators,
 *   - toggles into / out of `selectedIds` via the sentinel id,
 *   - is excluded from the select-all toggle.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OperatorMultiSelectDropdown } from '../OperatorMultiSelectDropdown'

// Radix DropdownMenu relies on pointer-capture APIs jsdom doesn't implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const OPERATORS = [
  { id: 10, name: 'Alice', isInactive: false },
  { id: 20, name: 'Bob', isInactive: false },
]

const SPECIAL = { id: -1, label: 'No Responsible' }

function renderDropdown(selectedIds: number[], onSelectionChange = vi.fn()) {
  render(
    <OperatorMultiSelectDropdown
      options={OPERATORS}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      specialOption={SPECIAL}
      selectAllLabel="All employees"
      trigger={<button type="button">open</button>}
    />
  )
  return onSelectionChange
}

async function openMenu() {
  const user = userEvent.setup()
  await user.click(screen.getByText('open'))
  await waitFor(() => expect(screen.getByText('No Responsible')).toBeInTheDocument())
  return user
}

describe('OperatorMultiSelectDropdown — special option (KAN-607)', () => {
  it('renders the special option alongside the operators', async () => {
    renderDropdown([])
    await openMenu()

    expect(screen.getByText('No Responsible')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('All employees')).toBeInTheDocument()
  })

  it('keeps the special option visible while the search hides operators', async () => {
    renderDropdown([])
    const user = await openMenu()

    const search = screen.getByPlaceholderText('pages.clients.filters.searchPlaceholder')
    await user.type(search, 'zzz') // matches no operator

    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
    // The special row is never filtered by search.
    expect(screen.getByText('No Responsible')).toBeInTheDocument()
  })

  it('adds the sentinel id on toggle', async () => {
    const onChange = renderDropdown([])
    const user = await openMenu()

    await user.click(screen.getByText('No Responsible'))
    expect(onChange).toHaveBeenCalledWith([-1])
  })

  it('removes the sentinel id when toggled off', async () => {
    const onChange = renderDropdown([-1])
    const user = await openMenu()

    await user.click(screen.getByText('No Responsible'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('select-all selects only real operators, leaving the sentinel untouched', async () => {
    const onChange = renderDropdown([-1])
    const user = await openMenu()

    await user.click(screen.getByText('All employees'))
    // Sentinel preserved, all real ids added.
    expect(onChange).toHaveBeenCalledWith([10, 20, -1])
  })
})
