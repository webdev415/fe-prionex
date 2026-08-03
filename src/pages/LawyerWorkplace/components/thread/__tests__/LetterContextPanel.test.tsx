import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { LetterDetail } from '@/pages/LawyerWorkplace/types'
import type { KanbanTask } from '@/pages/LawyerWorkplace/kanban/kanbanData'
import { LetterContextPanel } from '../LetterContextPanel'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string | Record<string, unknown>) =>
        typeof fallback === 'string' ? fallback : key,
      i18n: { language: 'uk' },
    }),
  }
})

const { useClientMock } = vi.hoisted(() => ({ useClientMock: vi.fn() }))

vi.mock('@/features/clients/hooks/useClients', () => ({
  useClient: useClientMock,
}))

const letter: LetterDetail = {
  id: 'msg-1',
  referenceId: 'INC-777',
  senderName: 'Client',
  senderEmail: 'client@example.com',
  routeFromEmail: 'client@example.com',
  routeToEmail: 'legal@prionex.ua',
  direction: 'incoming',
  receivedAt: '2026-07-02T09:00:00Z',
  subject: 'Complaint',
  mailbox: 'legal@prionex.ua',
  letterType: 'complaint',
  letterTypeLabel: 'Скарга',
  clientId: '10',
  clientName: 'Тест Клієнт',
  clientCode: 'CL-10',
  status: 'in_progress',
  isUnprocessed: false,
  recipientEmail: 'legal@prionex.ua',
  thread: [
    {
      id: 'msg-1',
      direction: 'incoming',
      senderName: 'Client',
      senderEmail: 'client@example.com',
      sentAt: '2026-07-02T09:00:00Z',
      body: 'Body',
      bodyFormat: 'text',
    },
  ],
  parameters: {
    letterType: 'complaint',
    clientId: '10',
    clientLabel: 'CL-10 · Тест Клієнт',
    clientLockedByEmail: false,
    clientProjectId: 1,
    contractId: 'C-1',
    contractLabel: 'C-1',
    dueDate: '2026-07-25T09:00:00Z',
    dueDateHint: '',
    lawyerId: '42',
    lawyerLabel: 'Petro Yurydychnyi',
    autoConfidence: 0,
    confirmedCount: 4,
    totalParameters: 4,
  },
  replyDraft: '',
  replyContext: {
    threadId: 'thread-1',
    mailboxId: 'mb-1',
    inReplyToMessageId: 'msg-1',
    clientId: 10,
    assignedUserId: 42,
  },
  legalTaskId: 501,
}

const task: KanbanTask = {
  id: 't-1',
  taskId: 501,
  type: 'complaint',
  title: 'Complaint',
  clientCode: 'CL-10',
  clientName: 'Тест Клієнт',
  deadline: '2026-07-25T09:00:00Z',
  closedAt: null,
  priority: 'high',
  assigneeInitials: 'PY',
  assigneeName: 'Petro Yurydychnyi',
  assigneeUserId: 42,
  columnId: 'in_progress',
  letterId: 'msg-1',
  letterTypeId: 'complaint',
  legalTaskId: 501,
  letterCount: 3,
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <LetterContextPanel letter={letter} task={task} />
    </MemoryRouter>
  )
}

describe('LetterContextPanel', () => {
  it('renders the client card, letter type and SLA', () => {
    useClientMock.mockReturnValue({
      data: {
        id: 10,
        tax_id: '1234567890',
        first_name: 'Тест',
        last_name: 'Клієнт',
        total_debt: '15000',
        status: 'active',
      },
    })

    renderPanel()

    // Client
    expect(screen.getByText('Тест Клієнт')).toBeInTheDocument()
    expect(screen.getByText('1234567890')).toBeInTheDocument()
    expect(screen.getByText('CL-10')).toBeInTheDocument()

    // Classification — type badge + SLA date (dd.mm.yyyy contains the year)
    expect(screen.getByText('Скарга')).toBeInTheDocument()
    expect(screen.getByText('INC-777')).toBeInTheDocument()
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0)

    // Assignment + history
    expect(screen.getByText('Petro Yurydychnyi')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    // Open card link
    const link = screen.getByRole('link', { name: /Open client card/i })
    expect(link).toHaveAttribute('href', '/dashboard/clients/10')
  })

  it('shows "not identified" when the letter has no client', () => {
    useClientMock.mockReturnValue({ data: undefined })

    const noClientLetter: LetterDetail = {
      ...letter,
      clientId: null,
      clientCode: null,
      clientName: null,
      parameters: { ...letter.parameters, clientId: '', clientLabel: '' },
      replyContext: { ...letter.replyContext, clientId: null },
    }

    render(
      <MemoryRouter>
        <LetterContextPanel letter={noClientLetter} task={task} />
      </MemoryRouter>
    )

    expect(screen.getByText('Client not identified')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open client card/i })).not.toBeInTheDocument()
  })
})
