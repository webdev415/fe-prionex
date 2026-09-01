/**
 * The pinned "My employees" shortcut inside the employee dropdown: selecting it
 * replaces the selection with its ids, selecting it again clears, and it is
 * disabled (with a count of 0) when the trainer has nobody under control.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { EmployeeMultiSelect, EmployeeSearchList } from '../EmployeeMultiSelect'

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

/** The i18n mock returns keys, so the search input is found by its key. */
const SEARCH_PLACEHOLDER = 'pages.training.dialogue.employee.searchPlaceholder'

describe('EmployeeMultiSelect search', () => {
  it('narrows the list to names matching the typed fragment', () => {
    render(<EmployeeMultiSelect value={[]} onChange={vi.fn()} operators={OPERATORS} />)
    openDropdown()
    expect(screen.getByText('Kateryna Antonova')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'bond' },
    })
    expect(screen.getByText('Oleh Bondar')).toBeInTheDocument()
    expect(screen.queryByText('Kateryna Antonova')).not.toBeInTheDocument()
    expect(screen.queryByText('Ivan Petrenko')).not.toBeInTheDocument()
  })

  it('shows the empty state when nothing matches', () => {
    render(<EmployeeMultiSelect value={[]} onChange={vi.fn()} operators={OPERATORS} />)
    openDropdown()
    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'zzz' },
    })
    expect(screen.getByText('pages.training.dialogue.employee.noMatches')).toBeInTheDocument()
  })

  it('still toggles a filtered row through onChange', () => {
    const onChange = vi.fn()
    render(<EmployeeMultiSelect value={[]} onChange={onChange} operators={OPERATORS} />)
    openDropdown()
    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'petrenko' },
    })
    fireEvent.click(screen.getByText('Ivan Petrenko'))
    expect(onChange).toHaveBeenCalledWith([43])
  })
})

describe('EmployeeSearchList single-pick mode', () => {
  it('hides excluded operators and picks by row click', () => {
    const onSelect = vi.fn()
    render(<EmployeeSearchList operators={OPERATORS} excludeIds={[41]} onSelect={onSelect} />)
    expect(screen.queryByText('Kateryna Antonova')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'oleh' },
    })
    expect(screen.queryByText('Ivan Petrenko')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Oleh Bondar'))
    expect(onSelect).toHaveBeenCalledWith(42)
  })
})
