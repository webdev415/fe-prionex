/**
 * The pinned "My employees" shortcut inside the employee dropdown: selecting it
 * replaces the selection with its ids, selecting it again clears, and it is
 * disabled (with a count of 0) when the trainer has nobody under control.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { EmployeeMultiSelect } from '../EmployeeMultiSelect'

const OPERATORS = [
  { id: 41, full_name: 'Kateryna Antonova' },
  { id: 42, full_name: 'Oleh Bondar' },
  { id: 43, full_name: 'Ivan Petrenko' },
] as unknown as OperatorUser[]

function openDropdown() {
  fireEvent.click(screen.getByRole('button', { expanded: false }))
}

/** The shortcut row, found by its count so it can't collide with the trigger
 *  label (which also reads "My employees" while the shortcut is active). */
function quickRow(count: number): HTMLButtonElement {
  return screen.getByText(`(${count})`).closest('button') as HTMLButtonElement
}

describe('EmployeeMultiSelect quick-select', () => {
  it('replaces the selection with the shortcut ids', () => {
    const onChange = vi.fn()
    render(
      <EmployeeMultiSelect
        value={[43]}
        onChange={onChange}
        operators={OPERATORS}
        quickSelect={{ label: 'My employees', ids: [41, 42] }}
      />
    )
    openDropdown()
    fireEvent.click(quickRow(2))
    expect(onChange).toHaveBeenCalledWith([41, 42])
  })

  it('clears when the shortcut is already the exact selection', () => {
    const onChange = vi.fn()
    render(
      <EmployeeMultiSelect
        value={[41, 42]}
        onChange={onChange}
        operators={OPERATORS}
        quickSelect={{ label: 'My employees', ids: [41, 42] }}
      />
    )
    openDropdown()
    fireEvent.click(quickRow(2))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('shows the count and disables the shortcut when there is nobody assigned', () => {
    const onChange = vi.fn()
    render(
      <EmployeeMultiSelect
        value={[]}
        onChange={onChange}
        operators={OPERATORS}
        quickSelect={{ label: 'My employees', ids: [], disabled: true, hint: 'none yet' }}
      />
    )
    openDropdown()
    const row = quickRow(0)
    expect(row).toBeDisabled()
    fireEvent.click(row)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('labels the trigger with the shortcut while it is active', () => {
    render(
      <EmployeeMultiSelect
        value={[41, 42]}
        onChange={vi.fn()}
        operators={OPERATORS}
        quickSelect={{ label: 'My employees', ids: [41, 42] }}
      />
    )
    expect(screen.getByRole('button', { expanded: false })).toHaveTextContent('My employees')
  })
})
