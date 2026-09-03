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

  // The roster genuinely holds the same person both ways round — the database
  // carries "Богданова Марина" and "Марина  Богданова" under one id, the second
  // with a doubled inner space. Matching the query as one string finds neither
  // when the trainer types the two words in the other order (KAN-1046 AC2).
  it('matches the full name whichever order the words are typed', () => {
    render(<EmployeeMultiSelect value={[]} onChange={vi.fn()} operators={OPERATORS} />)
    openDropdown()

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'petrenko ivan' },
    })

    expect(screen.getByText('Ivan Petrenko')).toBeInTheDocument()
    expect(screen.queryByText('Oleh Bondar')).not.toBeInTheDocument()
  })

  it('ignores repeated and surrounding whitespace in the query', () => {
    render(<EmployeeMultiSelect value={[]} onChange={vi.fn()} operators={OPERATORS} />)
    openDropdown()

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: '  antonova   kateryna  ' },
    })

    expect(screen.getByText('Kateryna Antonova')).toBeInTheDocument()
    expect(screen.queryByText('Ivan Petrenko')).not.toBeInTheDocument()
  })

  it('requires every typed word, not just one of them', () => {
    render(<EmployeeMultiSelect value={[]} onChange={vi.fn()} operators={OPERATORS} />)
    openDropdown()

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: 'ivan bondar' },
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

// The two assign dialogs this list replaced used real <input type="checkbox">
// elements, so screen readers announced each row's checked state. A row is now a
// button whose tick is a decorative <span>, which would have said nothing at all
// about what is selected (KAN-1046 review).
describe('EmployeeSearchList selection semantics', () => {
  it('exposes each row as a checkbox carrying its checked state', () => {
    render(<EmployeeMultiSelect value={[43]} onChange={vi.fn()} operators={OPERATORS} />)
    openDropdown()

    expect(screen.getByRole('checkbox', { name: /Ivan Petrenko/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Oleh Bondar/ })).not.toBeChecked()
  })

  it('names the row by the person, not by their avatar initials', () => {
    render(<EmployeeMultiSelect value={[]} onChange={vi.fn()} operators={OPERATORS} />)
    openDropdown()

    expect(screen.getByRole('checkbox', { name: 'Oleh Bondar' })).toBeInTheDocument()
  })

  it('leaves single-pick rows as plain buttons', () => {
    render(<EmployeeSearchList operators={OPERATORS} onSelect={vi.fn()} />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ivan Petrenko' })).toBeInTheDocument()
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
