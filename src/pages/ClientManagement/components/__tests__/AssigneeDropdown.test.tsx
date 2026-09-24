/**
 * AssigneeDropdown — the inline assignee picker on the client card.
 *
 * What these tests hold up, in order of how easily each could regress
 * unnoticed:
 *
 *   • the save waits for the server — the popover closes on success and stays
 *     open on failure. Closing on click instead would show a name the server
 *     never accepted, and the operator would already have looked away.
 *   • Unassign sends an explicit `null` for this row's slot and omits the
 *     other. Omitting means "leave alone" and null means "clear"; sending the
 *     wrong one silently blanks a colleague's assignment or silently does
 *     nothing.
 *   • the two permission gates fire before any request, as they did on the
 *     modal's Submit that this control replaces.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const mockOperators = vi.hoisted(() => ({
  value: [
    { id: 11, full_name: 'Іван Петренко', department_name: 'Collections' },
    { id: 22, full_name: 'Олена Коваль', department_name: null },
    { id: 33, full_name: 'Петро Шевченко', department_name: 'Legal' },
  ] as Array<{ id: number; full_name: string; department_name: string | null }>,
}))
vi.mock('@/features/users/hooks/useUsers', () => ({
  useOperators: () => ({ data: mockOperators.value, isLoading: false }),
}))

// Pins come from a query, so without this the component reaches a real
// `useQuery` and every test dies on "No QueryClient set". Mocked at the module
// the barrel re-exports, which is what the operators mock above relies on too.
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

// `mutate` is captured so a test can inspect the payload and drive either
// branch of the callbacks the component passes in.
const assignMutate = vi.hoisted(() => vi.fn())
vi.mock('@/features/clients/hooks/useClients', () => ({
  useAssignClient: () => ({ mutate: assignMutate, isPending: false }),
}))

const mockPermissions = vi.hoisted(() => new Set<string>())
vi.mock('@/hooks/usePermissions', () => ({
  useHasPermission: (perm: string) => mockPermissions.has(perm),
}))

// The real hook warns and swallows the click when the permission is missing.
// Mirrored here so the edit_clients path is exercised rather than bypassed.
vi.mock('@/hooks/useGuardedAction', () => ({
  useGuardedAction: (perm: string) => (action: () => void) => {
    if (!mockPermissions.has(perm)) return
    action()
  },
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { active_project_id: number } }) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

import { toast } from 'sonner'
import { AssigneeDropdown } from '../AssigneeDropdown'
import { PERMISSIONS } from '@/constants/permissions'
import { isHotkeyBlockingPopupOpen, isTypingTarget } from '@/features/taHotkeys/hotkey'

function renderOpen(props: Partial<React.ComponentProps<typeof AssigneeDropdown>> = {}): {
  onClose: ReturnType<typeof vi.fn>
} {
  const onClose = vi.fn()
  render(
    (
      <AssigneeDropdown
        clientId={7}
        slot="employee"
        currentUserId={null}
        isOpen
        onOpen={vi.fn()}
        onClose={onClose}
        {...props}
      />
    ) as ReactNode
  )
  return { onClose }
}

/** The payload of the most recent assign call. */
function lastPayload(): Record<string, unknown> {
  const call = assignMutate.mock.calls.at(-1)
  return (call?.[0] as { data: Record<string, unknown> }).data
}

/** Drive the callbacks the component handed to `mutate`. */
function resolveLastCall(outcome: 'success' | 'error') {
  const call = assignMutate.mock.calls.at(-1)
  const handlers = call?.[1] as { onSuccess?: () => void; onError?: () => void }
  if (outcome === 'success') handlers.onSuccess?.()
  else handlers.onError?.()
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPins.value = new Set()
  mockPermissions.clear()
  mockPermissions.add(PERMISSIONS.CLIENTS.EDIT)
  mockPermissions.add(PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE)
})

describe('AssigneeDropdown', () => {
  it('renders the operator list in a portal', () => {
    renderOpen()

    // Deliberately an existence assertion first: the popover renders through
    // FloatingPortal, and no other test in this repo does. If `screen` could
    // not reach the portal, every assertion below would pass vacuously.
    expect(screen.getByText('Іван Петренко')).toBeInTheDocument()
    expect(screen.getByText('Петро Шевченко')).toBeInTheDocument()
  })

  it('shows a dash for an operator with no department', () => {
    renderOpen()

    // Most operators carry no department in practice, so this is the common
    // row rather than an edge case. A blank would read as a render fault.
    expect(screen.getByText('Collections')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('filters by name, case-insensitively', () => {
    renderOpen()

    fireEvent.change(screen.getByPlaceholderText('Search employee'), {
      target: { value: 'олена' },
    })

    expect(screen.getByText('Олена Коваль')).toBeInTheDocument()
    expect(screen.queryByText('Іван Петренко')).not.toBeInTheDocument()
  })

  it('says so when nothing matches', () => {
    renderOpen()

    fireEvent.change(screen.getByPlaceholderText('Search employee'), {
      target: { value: 'zzzz' },
    })

    expect(screen.getByText('No matches')).toBeInTheDocument()
  })

  it('marks the currently assigned operator', () => {
    renderOpen({ currentUserId: 22 })

    const assigned = screen.getByText('Олена Коваль').closest('[role="option"]')
    expect(assigned).toHaveAttribute('aria-selected', 'true')
  })

  it('sends only this row-s slot when assigning', () => {
    renderOpen({ slot: 'employee' })

    fireEvent.click(screen.getByText('Іван Петренко'))

    const payload = lastPayload()
    expect(payload.responsible_employee_id).toBe(11)
    // The other slot must be ABSENT, not null: null would clear the searcher.
    expect('responsible_searcher_id' in payload).toBe(false)
    expect(payload.assignment_reason).toBe('Reassignment')
  })

  it('addresses the searcher slot when that is the row', () => {
    renderOpen({ slot: 'searcher' })

    fireEvent.click(screen.getByText('Іван Петренко'))

    const payload = lastPayload()
    expect(payload.responsible_searcher_id).toBe(11)
    expect('responsible_employee_id' in payload).toBe(false)
  })

  it('offers Unassign only when something is assigned', () => {
    renderOpen({ currentUserId: null })
    expect(screen.queryByText('Unassign')).not.toBeInTheDocument()

    renderOpen({ currentUserId: 11 })
    expect(screen.getByText('Unassign')).toBeInTheDocument()
  })

  it('clears the slot with an explicit null', () => {
    renderOpen({ currentUserId: 11 })

    fireEvent.click(screen.getByText('Unassign'))

    const payload = lastPayload()
    // Explicitly null, and present in the payload — the backend keys on which
    // fields were sent, so an omitted field would mean "leave it alone".
    expect(payload.responsible_employee_id).toBeNull()
    expect('responsible_employee_id' in payload).toBe(true)
  })

  it('closes only once the save succeeds', async () => {
    const { onClose } = renderOpen()

    fireEvent.click(screen.getByText('Іван Петренко'))
    // Still open: the request is in flight and the row has not been proven.
    expect(onClose).not.toHaveBeenCalled()

    resolveLastCall('success')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('stays open when the save fails', async () => {
    const { onClose } = renderOpen()

    fireEvent.click(screen.getByText('Іван Петренко'))
    resolveLastCall('error')

    // The operator keeps the popover and their place in the list; the
    // mutation's own onError raises the toast.
    await waitFor(() => expect(assignMutate).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })

  describe('on window resize', () => {
    const initialWidth = window.innerWidth
    const initialHeight = window.innerHeight

    function resizeTo(width: number, height: number) {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
      fireEvent(window, new Event('resize'))
    }

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: initialWidth })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: initialHeight })
    })

    it('closes when the width changes', () => {
      const { onClose } = renderOpen()

      resizeTo(initialWidth - 200, initialHeight)

      // Deliberate: `autoUpdate` would re-anchor the popover instead, so without
      // this the requirement passes review by looking right while never firing.
      expect(onClose).toHaveBeenCalled()
    })

    it('stays open when only the height shrinks — the on-screen keyboard', () => {
      const { onClose } = renderOpen()

      resizeTo(initialWidth, initialHeight - 300)

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('does not close on scroll — it follows the trigger', () => {
    const { onClose } = renderOpen()

    fireEvent.scroll(document, {})

    // The control of this pair: resize closing is only meaningful if scroll
    // does not, and both are handled by the same positioning machinery.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('refuses to reassign without the reassign permission', () => {
    mockPermissions.delete(PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE)
    renderOpen({ currentUserId: 33 })

    fireEvent.click(screen.getByText('Іван Петренко'))

    expect(assignMutate).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalled()
  })

  it('treats clearing a populated slot as a reassignment', () => {
    mockPermissions.delete(PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE)
    renderOpen({ currentUserId: 33 })

    fireEvent.click(screen.getByText('Unassign'))

    // The slot held somebody and would no longer — the same rule the service
    // applies, so the warning has to fire here too.
    expect(assignMutate).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalled()
  })

  it('allows a first assignment with only edit_clients', () => {
    mockPermissions.delete(PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE)
    renderOpen({ currentUserId: null })

    fireEvent.click(screen.getByText('Іван Петренко'))

    // Filling an empty slot is an initial assignment, not a reassignment.
    expect(assignMutate).toHaveBeenCalled()
  })

  it('swallows the click without edit_clients', () => {
    mockPermissions.clear()
    renderOpen({ currentUserId: null })

    fireEvent.click(screen.getByText('Іван Петренко'))

    expect(assignMutate).not.toHaveBeenCalled()
  })

  it('keeps TA quick-launch hotkeys suppressed while it is open', () => {
    renderOpen({ currentUserId: 11 })

    // Asserted against the real guard rather than against markup, because the
    // coupling is invisible from this component: the hotkey handler suppresses
    // bare-key bindings for any keypress the guard calls "typing", and that is
    // the only thing stopping a letter typed in here from launching a TA
    // template over an open popover.
    //
    // Three things carry that today, and any one of them is enough, because the
    // guard matches with `closest`: the search field is an `input`, the rows and
    // Unassign carry `role="option"`, and both sit inside the `role="listbox"`
    // wrapper. Deleting the rows' `role="option"` alone was tried here and did
    // NOT regress it — the listbox still matched. So this pins the property
    // rather than any one attribute, and it goes red only when a restructure
    // leaves some element with none of the three.
    expect(isTypingTarget(screen.getByPlaceholderText('Search employee'))).toBe(true)
    expect(isTypingTarget(screen.getByText('Іван Петренко'))).toBe(true)
    expect(isTypingTarget(screen.getByText('Unassign'))).toBe(true)
  })

  it('silences quick-launch while open even when focus has left it', () => {
    // The focus rule above is not enough on its own: a click on a heading or on
    // padding focuses nothing, and a pin toggle remounts the focused row. Both
    // leave the keydown target on <body>, which the guard does not call typing —
    // so a bound key launched a template over the open popover.
    const onClose = vi.fn()
    const props = {
      clientId: 7,
      slot: 'employee' as const,
      currentUserId: null,
      onOpen: vi.fn(),
      onClose,
    }
    const { rerender } = render(<AssigneeDropdown {...props} isOpen />)

    expect(isTypingTarget(document.body)).toBe(false)
    expect(isHotkeyBlockingPopupOpen()).toBe(true)

    // And only while open — a closed popover must not keep hotkeys off.
    rerender(<AssigneeDropdown {...props} isOpen={false} />)
    expect(isHotkeyBlockingPopupOpen()).toBe(false)
  })

  it('hands hotkeys back once closed, although focus returns to the trigger', () => {
    // Closing puts focus back on the pencil. It carries `aria-haspopup`, which
    // the hotkey guard reads as a widget that owns its keys; unless it lets go
    // while collapsed, every binding stays silent until the next click.
    const props = {
      clientId: 7,
      slot: 'employee' as const,
      currentUserId: null,
      onOpen: vi.fn(),
      onClose: vi.fn(),
    }
    const { rerender } = render(<AssigneeDropdown {...props} isOpen />)
    const pencil = screen.getByRole('button', { expanded: true })
    expect(isTypingTarget(pencil)).toBe(true)

    rerender(<AssigneeDropdown {...props} isOpen={false} />)
    pencil.focus()

    expect(document.activeElement).toBe(pencil)
    expect(isTypingTarget(pencil)).toBe(false)
  })

  it('keeps focus on the pin once its row has moved section', () => {
    const props = {
      clientId: 7,
      slot: 'employee' as const,
      currentUserId: null,
      isOpen: true,
      onOpen: vi.fn(),
      onClose: vi.fn(),
    }
    const { rerender } = render(<AssigneeDropdown {...props} />)

    fireEvent.click(screen.getAllByLabelText('Pin')[0])
    // What the optimistic cache update does: the pin set changes, and the row
    // re-renders under PINNED as a new element.
    mockPins.value = new Set([11])
    rerender(<AssigneeDropdown {...props} />)

    const pinnedGroup = screen.getByRole('group', { name: 'Pinned' })
    expect(pinnedGroup).toContainElement(document.activeElement as HTMLElement)
    expect(document.activeElement).toHaveAttribute('aria-label', 'Unpin')
  })

  it('hides the PINNED section while nothing is pinned', () => {
    renderOpen()

    // A section with no rows must not leave its heading behind.
    expect(screen.queryByText('Pinned')).not.toBeInTheDocument()
    expect(screen.getByText('All employees')).toBeInTheDocument()
  })

  it('splits pinned operators into their own section', () => {
    mockPins.value = new Set([22])
    renderOpen()

    expect(screen.getByText('Pinned')).toBeInTheDocument()
    expect(screen.getByText('All employees')).toBeInTheDocument()
    // The pinned operator belongs to the PINNED group, not the other one.
    const pinnedGroup = screen.getByRole('group', { name: 'Pinned' })
    expect(pinnedGroup).toHaveTextContent('Олена Коваль')
    expect(pinnedGroup).not.toHaveTextContent('Іван Петренко')
  })

  it('pins without assigning and without closing', () => {
    const { onClose } = renderOpen({ currentUserId: null })

    fireEvent.click(screen.getAllByLabelText('Pin')[0])

    expect(mockPins.pin).toHaveBeenCalledWith(11)
    // The two are siblings rather than nested, so a pin press must never reach
    // the assign handler — this is the assertion that holds that structure.
    expect(assignMutate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('unpins an already-pinned operator', () => {
    mockPins.value = new Set([11])
    const { onClose } = renderOpen({ currentUserId: null })

    fireEvent.click(screen.getByLabelText('Unpin'))

    expect(mockPins.unpin).toHaveBeenCalledWith(11)
    expect(assignMutate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
