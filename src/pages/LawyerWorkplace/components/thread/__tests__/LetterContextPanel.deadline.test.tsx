/**
 * The drawer's "Deadline / SLA" row has to read the same as the kanban card
 * behind it (KAN-1000).
 *
 * Both of its branches used to go through `formatDueDate`, which reads the
 * offset-less wire value on the browser clock. This pins the rendered row so
 * the divergence cannot come back unnoticed.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { KanbanTask } from '../../../kanban/kanbanData'
import type { LetterDetail } from '../../../types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('@/features/lawyerWorkplace/hooks/useLegalProfileTimezone', () => ({
  useLegalProfileTimezone: () => 'Europe/Kyiv',
}))

vi.mock('@/features/clients/hooks/useClients', () => ({
  useClient: () => ({ data: undefined }),
}))

const { LetterContextPanel } = await import('../LetterContextPanel')

const task: KanbanTask = {
  id: 'TASK-1',
  taskId: 1,
  type: 'complaint',
  title: 'Legal: Complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  clientId: 10,
  // What the task service actually sends: naive UTC, no designator.
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
}

function letterWith(dueDate: string): LetterDetail {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    subject: 'Late payment complaint',
    clientId: null,
    clientName: null,
    receivedAt: '2026-08-10T09:00:00+00:00',
    recipientEmail: 'legal@prionex.ua',
    thread: [],
    replyDraft: '',
    replyContext: {
      threadId: 'thread-1',
      mailboxId: null,
      inReplyToMessageId: 'msg-1',
      clientId: null,
      assignedUserId: null,
    },
    parameters: {
      clientId: '',
      clientLabel: '',
      dueDate,
      dueDateHint: '',
    },
  } as unknown as LetterDetail
}

function renderPanel(letter: LetterDetail, withTask: boolean) {
  return render(
    <MemoryRouter>
      <LetterContextPanel letter={letter} task={withTask ? task : undefined} />
    </MemoryRouter>
  )
}

describe('LetterContextPanel deadline row', () => {
  it('falls back to the kanban deadline on the profile clock, not the browser one', () => {
    renderPanel(letterWith(''), true)
    // 03:00 UTC is 06:00 in Kyiv — the time the card shows and the lawyer picked.
    expect(screen.getByText('14.08.2026, 06:00')).toBeInTheDocument()
    expect(screen.queryByText('14.08.2026, 03:00')).not.toBeInTheDocument()
  })

  it('renders an SLA date-only due date as a date, with no invented time', () => {
    renderPanel(letterWith('2026-08-14'), true)
    expect(screen.getByText('14.08.2026')).toBeInTheDocument()
  })

  it('prefers the SLA due date over the kanban fallback', () => {
    renderPanel(letterWith('2026-09-01'), true)
    expect(screen.getByText('01.09.2026')).toBeInTheDocument()
    expect(screen.queryByText('14.08.2026, 06:00')).not.toBeInTheDocument()
  })
})
