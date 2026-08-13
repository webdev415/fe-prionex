/**
 * Deadline save feedback on the kanban board (KAN-1000).
 *
 * The picker lives behind a Radix submenu, so these drive `onTaskUpdate` from
 * the rendered card rather than clicking through the calendar — the toast
 * decision is what is under test, not react-datepicker.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

const capturedCardProps = vi.hoisted(
  () => [] as Array<{ task: { id: string }; onTaskUpdate?: (id: string, patch: unknown) => void }>
)

const kanbanTask = vi.hoisted(() => ({
  id: 'TASK-1',
  taskId: 1,
  type: 'complaint',
  title: 'Legal: Complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  clientId: 10,
  deadline: '2026-08-14T03:00:00',
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 7,
  columnId: 'in_progress',
  letterId: null,
  letterTypeId: 'complaint',
  legalTaskId: 1,
  letterCount: 1,
}))

vi.mock('sonner', () => ({ toast: toastMock }))

// The shared setup mock treats t's second argument as options and never
// applies a defaultValue, so the toast copy would come back as bare keys.
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

vi.mock('../KanbanCard', () => ({
  KanbanCard: (props: {
    task: { id: string }
    onTaskUpdate?: (id: string, p: unknown) => void
  }) => {
    capturedCardProps.push(props)
    return <div data-testid={`card-${props.task.id}`}>{props.task.id}</div>
  },
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

function setDeadline(iso: string | null) {
  const card = capturedCardProps.find((props) => props.task.id === 'TASK-1')
  expect(card?.onTaskUpdate).toBeTypeOf('function')
  card!.onTaskUpdate!('TASK-1', { deadline: iso })
}

describe('LegalKanbanBoard deadline feedback', () => {
  beforeEach(() => {
    capturedCardProps.length = 0
    toastMock.success.mockClear()
    toastMock.error.mockClear()
    mutations.patchMetadata.mockReset().mockResolvedValue(undefined)
    mutations.updateTask.mockReset().mockResolvedValue(undefined)
  })

  it('confirms a saved deadline with the time the user picked', async () => {
    renderBoard()
    await screen.findByTestId('card-TASK-1')

    setDeadline('2026-08-14T03:00:00.000Z')

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1))
    expect(toastMock.success.mock.calls[0][0]).toContain('06:00')
    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it('reports a distinct message when the save fails', async () => {
    mutations.patchMetadata.mockRejectedValue(new Error('boom'))
    renderBoard()
    await screen.findByTestId('card-TASK-1')

    setDeadline('2026-08-14T03:00:00.000Z')

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledTimes(1))
    expect(toastMock.error.mock.calls[0][0]).toBe('Deadline was not saved')
    expect(toastMock.success).not.toHaveBeenCalled()
  })

  it('asks the mutation to hold its generic error toast so only one fires', async () => {
    renderBoard()
    await screen.findByTestId('card-TASK-1')

    setDeadline('2026-08-14T03:00:00.000Z')

    await waitFor(() => expect(mutations.patchMetadata).toHaveBeenCalledTimes(1))
    expect(mutations.patchMetadata.mock.calls[0][0]).toMatchObject({
      taskId: 1,
      payload: { due_date: '2026-08-14T03:00:00.000Z' },
      suppressErrorToast: true,
    })
  })

  it('says so when the deadline is cleared rather than set', async () => {
    renderBoard()
    await screen.findByTestId('card-TASK-1')

    setDeadline(null)

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1))
    expect(toastMock.success.mock.calls[0][0]).toBe('Deadline cleared')
  })

  it('stays quiet for a patch that does not touch the deadline', async () => {
    renderBoard()
    await screen.findByTestId('card-TASK-1')

    const card = capturedCardProps.find((props) => props.task.id === 'TASK-1')
    card!.onTaskUpdate!('TASK-1', { assigneeUserId: 9 })

    await waitFor(() => expect(mutations.patchMetadata).toHaveBeenCalledTimes(1))
    expect(mutations.patchMetadata.mock.calls[0][0]).toMatchObject({ suppressErrorToast: false })
    expect(toastMock.success).not.toHaveBeenCalled()
  })
})
