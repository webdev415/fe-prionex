/**
 * AssigneeSelect — the picker used inside the assign modals.
 *
 * What these tests hold up, in order of how quietly each could regress:
 *
 *   • the panel renders INLINE, not through a portal. A portalled panel sits
 *     outside the Radix dialog's content, so the modal would treat every pick
 *     as an outside press and dismiss itself. Nothing about the component
 *     *looks* wrong when that happens — the modal just vanishes mid-edit.
 *   • Escape closes the picker and stops there. Left to bubble, Radix reads the
 *     same key as "close the dialog" and the half-filled form is lost.
 *   • a click only stages the choice. This control replaced one that assigned
 *     on selection; if it ever saves again, the modal's Assign button stops
 *     being the thing that decides.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// The picker fetches its own pins, so without this it reaches a real
// `useQuery` and every test here dies on "No QueryClient set".
const mockPins = vi.hoisted(() => ({
  value: new Set<number>(),
  pin: vi.fn(),
  unpin: vi.fn(),
}))
vi.mock('@/features/users/hooks/useOperatorPins', () => ({
  useOperatorPins: () => ({ data: mockPins.value }),
  usePinOperator: () => ({ mutate: mockPins.pin }),
  useUnpinOperator: () => ({ mutate: mockPins.unpin }),
}))

import { AssigneeSelect } from '../AssigneeSelect'

const operators = [
  { id: 11, full_name: 'Іван Петренко', department_name: 'Collections' },
  { id: 22, full_name: 'Олена Коваль', department_name: null },
]

function setup(props: Partial<React.ComponentProps<typeof AssigneeSelect>> = {}) {
  const onValueChange = vi.fn()
  const utils = render(
    <AssigneeSelect operators={operators} value="" onValueChange={onValueChange} {...props} />
  )
  return { onValueChange, ...utils }
}

/** The collapsed trigger, whatever label it currently carries. */
function trigger(): HTMLElement {
  return screen.getByRole('button', { expanded: false })
}

describe('AssigneeSelect', () => {
  it('keeps the list closed until the trigger is clicked', () => {
    setup()

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.click(trigger())

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByText('Іван Петренко')).toBeInTheDocument()
  })

  it('renders the panel inside its own wrapper rather than a portal', () => {
    const { container } = setup()

    fireEvent.click(trigger())

    // The load-bearing assertion of this file: a portalled panel would land on
    // document.body, outside `container`, and dismiss the surrounding modal on
    // every pick.
    expect(container).toContainElement(screen.getByRole('listbox'))
  })

  it('shows the placeholder while nothing is chosen', () => {
    setup({ placeholder: 'Select employee' })

    expect(screen.getByText('Select employee')).toBeInTheDocument()
  })

  it('shows the chosen name over its department', () => {
    setup({ value: '11' })

    expect(screen.getByText('Іван Петренко')).toBeInTheDocument()
    expect(screen.getByText('Collections')).toBeInTheDocument()
  })

  it('shows a dash for a chosen operator with no department', () => {
    setup({ value: '22' })

    // Most operators carry no department, so this is the common row.
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('stages the choice and closes only the list', () => {
    const { onValueChange } = setup()

    fireEvent.click(trigger())
    fireEvent.click(screen.getByText('Олена Коваль'))

    // A string, because the modals hold the staged selection as an id string.
    expect(onValueChange).toHaveBeenCalledWith('22')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('filters the list by name', () => {
    setup()

    fireEvent.click(trigger())
    fireEvent.change(screen.getByPlaceholderText('Search employee'), {
      target: { value: 'олена' },
    })

    expect(screen.getByText('Олена Коваль')).toBeInTheDocument()
    expect(screen.queryByText('Іван Петренко')).not.toBeInTheDocument()
  })

  it('closes on Escape without letting the key reach the dialog', () => {
    // Stands in for Radix's dialog: a capture listener on `document`,
    // registered before the picker opens, that dismisses unless the event was
    // already default-prevented.
    const dismissDialog = vi.fn()
    const radixEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) dismissDialog()
    }
    document.addEventListener('keydown', radixEscape, true)

    try {
      setup()

      fireEvent.click(trigger())
      fireEvent.keyDown(screen.getByPlaceholderText('Search employee'), { key: 'Escape' })

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      // If Radix sees an un-prevented Escape, the whole modal closes and the
      // operator loses the form.
      expect(dismissDialog).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', radixEscape, true)
    }
  })

  it('closes when the pointer goes down outside it', () => {
    setup()

    fireEvent.click(trigger())
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('stays open when the pointer goes down inside it', () => {
    setup()

    fireEvent.click(trigger())
    fireEvent.pointerDown(screen.getByPlaceholderText('Search employee'))

    // The control for the pair above: scoping the outside-press to the wrapper
    // is only meaningful if an inside press does not close it.
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})
