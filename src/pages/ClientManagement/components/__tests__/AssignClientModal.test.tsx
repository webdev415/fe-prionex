/**
 * AssignClientModal — the single-client assign modal.
 *
 * The modal keeps its own contract deliberately: Cancel/Assign buttons, a
 * visible Assignment Reason, and no auto-close on picking a row. Only the
 * picker inside it changed. These tests pin the parts that would break
 * silently:
 *
 *   • the per-field reassign rule — filling an empty slot needs only
 *     edit_clients, but moving an already-assigned one needs the reassign
 *     permission. Getting this wrong lets a user quietly take a colleague's
 *     client.
 *   • Assign stays disabled until both a slot and a reason exist, because the
 *     backend rejects a body that names no slot.
 *   • submitting hands up the staged ids and closes — the picker itself must
 *     never be what saves.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const mockClient = vi.hoisted(() => ({
  value: {
    id: 7,
    first_name: 'Тест',
    last_name: 'Клієнт',
    responsible_employee_id: null as number | null,
    responsible_searcher_id: null as number | null,
    priority_score: 50,
    total_debt: '1000',
    debt_count: 1,
  },
}))

vi.mock('@/features/clients/hooks/useClients', () => ({
  useClient: () => ({ data: mockClient.value, isLoading: false }),
}))

vi.mock('@/features/clients/hooks/useConfig', () => ({
  usePriorityThresholds: () => ({ data: undefined }),
}))

vi.mock('@/features/users/hooks/useUsers', () => ({
  useOperators: () => ({
    data: [
      { id: 11, full_name: 'Іван Петренко', department_name: 'Collections' },
      { id: 22, full_name: 'Олена Коваль', department_name: null },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: { active_project_id: number } }) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

// The picker inside this modal fetches its own pins; without this the modal
// reaches a real `useQuery` and dies on "No QueryClient set".
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

const perms = vi.hoisted(() => new Set<string>())
vi.mock('@/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useHasPermission: (permission: string) => perms.has(permission),
  // Mirrors the real hook: swallows the action when the permission is absent.
  useGuardedAction: (permission: string) => (action: () => void) => {
    if (perms.has(permission)) action()
  },
}))

import { toast } from 'sonner'
import { AssignClientModal } from '../AssignClientModal'
import { PERMISSIONS } from '@/constants/permissions'

/**
 * Renders the modal, ready to interact with immediately.
 *
 * Deliberately no waiting: the form derives its slots from the client during
 * render, so they are correct on the first paint. This used to need a flushed
 * animation frame, because the modal copied the client into state one frame
 * after opening and that copy landed on top of anything picked in between. If
 * that deferred seeding ever returns, the picks made below get overwritten and
 * these tests fail — which is the point of not waiting here.
 */
function renderModal() {
  const onAssign = vi.fn()
  const onClose = vi.fn()
  render(<AssignClientModal open clientId={7} onClose={onClose} onAssign={onAssign} />)
  return { onAssign, onClose }
}

/** The modal renders through a Radix portal, so query the document, not the container. */
function slotTrigger(id: 'employee' | 'searcher'): HTMLElement {
  return document.querySelector(`#${id}`) as HTMLElement
}

function assignButton(): HTMLElement {
  return screen.getByRole('button', {
    name: 'pages.clients.modals.assignClient.assignClient',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  perms.clear()
  perms.add(PERMISSIONS.CLIENTS.EDIT)
  perms.add(PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE)
  mockClient.value = {
    ...mockClient.value,
    responsible_employee_id: null,
    responsible_searcher_id: null,
  }
})

describe('AssignClientModal', () => {
  it('keeps Assign disabled until a slot and a reason are both chosen', async () => {
    renderModal()

    expect(assignButton()).toBeDisabled()

    fireEvent.click(slotTrigger('employee'))
    fireEvent.click(screen.getByText('Іван Петренко'))

    // A slot alone is not enough — the reason is still empty.
    expect(assignButton()).toBeDisabled()

    fireEvent.click(screen.getByRole('radio', { name: 'New Client' }))

    await waitFor(() => expect(assignButton()).toBeEnabled())
  })

  it('hands up the staged slot and reason, then closes', async () => {
    const { onAssign, onClose } = renderModal()

    fireEvent.click(slotTrigger('employee'))
    fireEvent.click(screen.getByText('Іван Петренко'))
    fireEvent.click(screen.getByRole('radio', { name: 'New Client' }))

    await waitFor(() => expect(assignButton()).toBeEnabled())
    fireEvent.click(assignButton())

    expect(onAssign).toHaveBeenCalledWith({
      employeeId: '11',
      searcherId: undefined,
      reason: 'New Client',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('treats filling an empty slot as an initial assignment', async () => {
    perms.delete(PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE)
    const { onAssign } = renderModal()

    fireEvent.click(slotTrigger('employee'))
    fireEvent.click(screen.getByText('Іван Петренко'))
    fireEvent.click(screen.getByRole('radio', { name: 'New Client' }))

    await waitFor(() => expect(assignButton()).toBeEnabled())
    fireEvent.click(assignButton())

    // NULL -> user needs only edit_clients.
    expect(onAssign).toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('refuses to move an already-assigned slot without the reassign permission', async () => {
    mockClient.value = { ...mockClient.value, responsible_employee_id: 11 }
    perms.delete(PERMISSIONS.CLIENTS.REASSIGN_RESPONSIBLE)
    const { onAssign } = renderModal()

    // The form pre-populates from the client on open.
    await waitFor(() => expect(screen.getByText('Іван Петренко')).toBeInTheDocument())

    fireEvent.click(slotTrigger('employee'))
    fireEvent.click(screen.getByText('Олена Коваль'))
    fireEvent.click(screen.getByRole('radio', { name: 'New Client' }))

    await waitFor(() => expect(assignButton()).toBeEnabled())
    fireEvent.click(assignButton())

    expect(onAssign).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalled()
  })

  it('resets and closes on Cancel without assigning', async () => {
    const { onAssign, onClose } = renderModal()

    fireEvent.click(slotTrigger('employee'))
    fireEvent.click(screen.getByText('Іван Петренко'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onAssign).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
