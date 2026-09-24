/**
 * BulkAssignClientModal — the multi-client assign modal.
 *
 * What these tests hold up:
 *
 *   • a searcher-only selection is a valid submit. This is the UI half of a
 *     regression that already shipped once on the backend, where a bulk assign
 *     naming only the employee wiped every client's searcher. Nothing here
 *     would look wrong; the other slot just empties.
 *   • Assign stays disabled until a slot is named, because the request schema
 *     requires at least one.
 *   • the permission gate fires before any request, not after.
 *   • the reason defaults rather than starting empty — the modal keeps its
 *     visible Assignment Reason, unlike the inline popover which sends a fixed
 *     value the user never sees.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

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

const hasAnyPerm = vi.hoisted(() => ({ value: true }))
vi.mock('@/hooks', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useHasAnyPermission: () => hasAnyPerm.value,
}))

import { toast } from 'sonner'
import { BulkAssignClientModal } from '../BulkAssignClientModal'

const selectedClients = [
  { id: 1, fullName: 'Клієнт Перший', priority: 'High' as const, score: 60, debt: '1000' },
  { id: 2, fullName: 'Клієнт Другий', priority: 'Low' as const, score: 20, debt: '2000' },
]

function renderModal() {
  const onAssign = vi.fn()
  const onClose = vi.fn()
  render(
    <BulkAssignClientModal
      open
      selectedClientIds={new Set([1, 2])}
      selectedClients={selectedClients}
      onClose={onClose}
      onAssign={onAssign}
    />
  )
  return { onAssign, onClose }
}

/** The modal renders through a Radix portal, so query the document, not the container. */
function slotTrigger(id: 'bulk-employee' | 'bulk-searcher'): HTMLElement {
  return document.querySelector(`#${id}`) as HTMLElement
}

function assignButton(): HTMLElement {
  return screen.getByRole('button', {
    name: 'pages.clients.modals.bulkAssignClient.assignAllClients',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  hasAnyPerm.value = true
})

describe('BulkAssignClientModal', () => {
  it('keeps Assign disabled until a slot is named', () => {
    renderModal()

    // The reason already defaults, so the slot is the only thing missing.
    expect(assignButton()).toBeDisabled()

    fireEvent.click(slotTrigger('bulk-employee'))
    fireEvent.click(screen.getByText('Іван Петренко'))

    expect(assignButton()).toBeEnabled()
  })

  it('submits the employee with the default distribution and reason', () => {
    const { onAssign, onClose } = renderModal()

    fireEvent.click(slotTrigger('bulk-employee'))
    fireEvent.click(screen.getByText('Іван Петренко'))
    fireEvent.click(assignButton())

    expect(onAssign).toHaveBeenCalledWith({
      employeeId: '11',
      searcherId: undefined,
      distributionMethod: 'assign-all',
      reason: 'Workload Distribution',
      notes: undefined,
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('accepts a searcher-only selection and leaves the employee unnamed', () => {
    const { onAssign } = renderModal()

    fireEvent.click(slotTrigger('bulk-searcher'))
    fireEvent.click(screen.getByText('Олена Коваль'))
    fireEvent.click(assignButton())

    // `employeeId` must be absent, not empty-string: the request builder drops
    // unnamed slots so the backend leaves them alone.
    expect(onAssign).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: undefined, searcherId: '22' })
    )
  })

  it('warns instead of submitting when the user holds neither permission', () => {
    hasAnyPerm.value = false
    const { onAssign } = renderModal()

    fireEvent.click(slotTrigger('bulk-employee'))
    fireEvent.click(screen.getByText('Іван Петренко'))
    fireEvent.click(assignButton())

    expect(onAssign).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalled()
  })

  it('closes on Cancel without assigning', () => {
    const { onAssign, onClose } = renderModal()

    fireEvent.click(slotTrigger('bulk-employee'))
    fireEvent.click(screen.getByText('Іван Петренко'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onAssign).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
