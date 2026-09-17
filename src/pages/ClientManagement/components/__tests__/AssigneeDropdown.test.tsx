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

import { describe, it, expect, beforeEach, vi } from 'vitest'
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

  it('closes on window resize', () => {
    const { onClose } = renderOpen()

    fireEvent(window, new Event('resize'))

    // Deliberate: `autoUpdate` would re-anchor the popover instead, so without
    // this the requirement passes review by looking right while never firing.
    expect(onClose).toHaveBeenCalled()
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
})
