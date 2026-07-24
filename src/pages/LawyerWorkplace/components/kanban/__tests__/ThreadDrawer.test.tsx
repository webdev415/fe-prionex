import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { KanbanTask } from '../../../kanban/kanbanData'
import { ThreadDrawer } from '../ThreadDrawer'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/features/clients/hooks/useClients', () => ({
  useClient: () => ({ data: null, isLoading: false, isError: false }),
  useClients: () => ({ data: { items: [] }, isLoading: false, isError: false }),
}))

const letterA = {
  id: 'letter-a',
  thread_id: 'thread-a',
  mailbox_id: 'mb-1',
  subject: 'First letter',
  from_address: 'client@example.com',
  processing_status: 'in_progress',
  direction: 'incoming',
  received_at: '2026-07-01T09:00:00Z',
  is_quarantined: false,
  needs_manual_review: false,
  suggested_letter_type_id: null,
  suggested_client_id: null,
  suggested_lawyer_user_id: null,
  auto_process_eligible: false,
}

const letterB = {
  ...letterA,
  id: 'letter-b',
  thread_id: 'thread-b',
  subject: 'Second letter',
  received_at: '2026-07-02T09:00:00Z',
}

const messageB = {
  id: 'letter-b',
  thread_id: 'thread-b',
  mailbox_id: 'mb-1',
  internet_message_id: '<letter-b@example.com>',
  subject: 'Second letter',
  from_address: 'client@example.com',
  to_addresses: ['legal@prionex.ua'],
  cc_addresses: [] as string[],
  body_text: '',
  body_html: null,
  processing_status: 'in_progress',
  direction: 'incoming',
  received_at: '2026-07-02T09:00:00Z',
  sent_at: null,
  is_quarantined: false,
  quarantine_reason: null,
  needs_manual_review: false,
  suggested_letter_type_id: null,
  suggested_client_id: null,
  suggested_lawyer_user_id: null,
  auto_process_eligible: false,
  attachments: [] as [],
}

const threadA = {
  id: 'thread-a',
  subject: 'First letter',
  root_message_id: 'a1',
  messages: [
    {
      id: 'a1',
      direction: 'incoming',
      from_address: 'client@example.com',
      subject: 'First letter',
      body_text: 'Body A1',
      body_html: null,
      received_at: '2026-07-01T09:00:00Z',
      sent_at: null,
      processing_status: 'in_progress',
      is_quarantined: false,
      to_addresses: [] as string[],
      attachments: [] as [],
    },
  ],
}

const threadB = {
  ...threadA,
  id: 'thread-b',
  subject: 'Second letter',
  root_message_id: 'b1',
  messages: [
    { ...threadA.messages[0], id: 'b1', body_text: 'Body B1', received_at: '2026-07-02T09:00:00Z' },
  ],
}

const listTaskLetters = vi.fn((_legalTaskId: number) =>
  Promise.resolve({ items: [letterB, letterA] })
)
const getMessage = vi.fn((_messageId: string) => Promise.resolve(messageB))
const getThread = vi.fn((threadId: string) =>
  Promise.resolve(threadId === 'thread-a' ? threadA : threadB)
)

vi.mock('@/features/lawyerWorkplace/api/legalApi', () => ({
  legalApi: {
    listTaskLetters: (...args: [number]) => listTaskLetters(...args),
    getMessage: (...args: [string]) => getMessage(...args),
    getThread: (...args: [string]) => getThread(...args),
    listLetterTypes: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    listLawyers: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    listMailboxes: vi.fn(() => Promise.resolve({ items: [] })),
    getReplyDraft: vi.fn(() =>
      Promise.resolve({
        exists: false,
        message_id: '',
        mailbox_id: null,
        body_text: '',
        edo_type: 'none',
        updated_at: '',
      })
    ),
    listReplyStagedAttachments: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
    listComposerReplyTemplates: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
  },
  downloadLegalAttachment: vi.fn(),
  downloadLegalDocument: vi.fn(),
  exportLegalDocumentPdf: vi.fn(),
}))

const groupedTask: KanbanTask = {
  id: 'TASK-77',
  taskId: 77,
  type: 'complaint',
  title: 'Grouped complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  deadline: null,
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 42,
  columnId: 'in_progress',
  letterId: 'letter-b',
  letterTypeId: 'complaint',
  legalTaskId: 77,
  letterCount: 2,
}

function renderDrawer() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThreadDrawer target={{ letterId: 'letter-b', task: groupedTask }} onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

describe('ThreadDrawer — grouped-letter thread', () => {
  it('renders the drawer panel at 75vw width', () => {
    const { container } = renderDrawer()
    const panel = container.querySelector('[aria-hidden="false"]')
    expect(panel).toHaveClass('sm:w-[75vw]')
  })

  it('merges every grouped letter into one chronological thread', async () => {
    renderDrawer()

    const first = await screen.findByText('Body A1')
    const second = await screen.findByText('Body B1')

    // Oldest letter first — the group renders as a single chronological thread.
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Grouped-letter endpoint was queried with the legal task id.
    expect(listTaskLetters).toHaveBeenCalledWith(77)
  })
})
