/**
 * Opening a kanban task must allow acting on it (complaint of 04.08, item 8).
 *
 * The full wiring under test: card click opens the drawer with the detail
 * panel, and the panel's «Передати в роботу» button goes through
 * handleMoveTask → useTransitionLegalKanbanTask — the same transition
 * endpoint the drag-and-drop and the card's kebab menu use.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

const mutations = vi.hoisted(() => ({
  patchMetadata: vi.fn(),
  updateTask: vi.fn(),
  transition: vi.fn(),
}))

// A task with no linked letter → the drawer shows the editable detail panel.
const kanbanTask = vi.hoisted(() => ({
  id: 'TASK-1',
  taskId: 1,
  type: 'complaint',
  title: 'Legal: Complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  clientId: 10,
  deadline: null,
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 7,
  columnId: 'not_defined',
  letterId: null,
  letterTypeId: 'complaint',
  legalTaskId: 1,
  letterCount: 1,
}))

vi.mock('sonner', () => ({ toast: toastMock }))

// The shared setup mock treats t's second argument as options and never
// applies a defaultValue, so the button copy would come back as bare keys.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string, vars?: Record<string, unknown>) => {
      const template = typeof defaultValue === 'string' ? defaultValue : key
      if (!vars) return template
      return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
        name in vars ? String(vars[name]) : match
      )
    },
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('@/features/lawyerWorkplace/hooks/useLegalProfileTimezone', () => ({
  useLegalProfileTimezone: () => 'Europe/Kyiv',
}))

vi.mock('../../../context/lawyerWorkplaceLayout', async () => {
  const actual = await vi.importActual<
    typeof import('@/pages/LawyerWorkplace/context/lawyerWorkplaceLayout')
  >('@/pages/LawyerWorkplace/context/lawyerWorkplaceLayout')
  return {
    ...actual,
    useLawyerWorkplaceLayout: () => ({
      ref: { current: null },
      contentWidth: 1440,
      isCompact: false,
      isKanbanGrid: true,
      isWide: true,
      showWorkspaceBanner: false,
    }),
  }
})

// The card itself is under test elsewhere — here it only needs to open the drawer.
vi.mock('../KanbanCard', () => ({
  KanbanCard: (props: { task: { id: string }; onCardClick?: (task: unknown) => void }) => (
    <button
      type="button"
      data-testid={`card-${props.task.id}`}
      onClick={() => props.onCardClick?.(props.task)}
    >
      {props.task.id}
    </button>
  ),
}))

vi.mock('@/features/lawyerWorkplace', async () => {
  const actual = await vi.importActual<typeof import('@/features/lawyerWorkplace')>(
    '@/features/lawyerWorkplace'
  )
  return {
    ...actual,
    useLegalKanban: () => ({
      tasks: [kanbanTask],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useLegalLawyers: () => ({ data: { items: [] } }),
    useLegalLetterTypes: () => ({ data: { items: [] } }),
    useUpdateLegalKanbanTask: () => ({ mutateAsync: mutations.updateTask }),
    usePatchLegalKanbanTaskMetadata: () => ({ mutateAsync: mutations.patchMetadata }),
    useTransitionLegalKanbanTask: () => ({ mutate: mutations.transition, isPending: false }),
  }
})

const { LegalKanbanBoard } = await import('../LegalKanbanBoard')

// Radix menus rely on pointer-capture APIs jsdom does not implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LegalKanbanBoard />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LegalKanbanBoard — opened task panel actions', () => {
  beforeEach(() => {
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    mutations.transition.mockReset()
    mutations.patchMetadata.mockReset().mockResolvedValue(undefined)
    mutations.updateTask.mockReset().mockResolvedValue(undefined)
  })

  it('«Передати в роботу» in the open panel calls the transition endpoint', async () => {
    renderBoard()

    fireEvent.click(await screen.findByTestId('card-TASK-1'))
    fireEvent.click(await screen.findByRole('button', { name: /Передати в роботу/ }))

    expect(mutations.transition).toHaveBeenCalledTimes(1)
    expect(mutations.transition.mock.calls[0][0]).toEqual({
      taskId: 1,
      targetColumn: 'in_progress',
      timezone: 'Europe/Kyiv',
    })
  })

  it('priority picked in the open panel goes through the task-update mutation', async () => {
    renderBoard()

    fireEvent.click(await screen.findByTestId('card-TASK-1'))
    const trigger = await screen.findByRole('button', { name: 'Change priority' })
    fireEvent.pointerDown(trigger, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
    fireEvent.pointerUp(trigger, { pointerId: 1, pointerType: 'mouse', button: 0, bubbles: true })
    fireEvent.click(trigger)
    const option = await screen.findByText('High')
    fireEvent.click(option)

    await waitFor(() => expect(mutations.updateTask).toHaveBeenCalledTimes(1))
    expect(mutations.updateTask.mock.calls[0][0]).toMatchObject({
      taskId: 1,
      payload: { priority: 'high' },
    })
  })
})
