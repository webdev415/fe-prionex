/**
 * A kanban task created with no client link shows a dash, not a name (KAN-1008).
 *
 * The card used to fall back to the inbox's italic "unidentified" label, which
 * is the classifier's wording for a letter it could not match. On a confirmed
 * task the two are different things: a missing client here means the operator
 * ticked "no client link" on purpose.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { KanbanTask } from '../../../kanban/kanbanData'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('react-datepicker', () => ({ default: () => <div /> }))

const { KanbanCard } = await import('../KanbanCard')

const baseTask: KanbanTask = {
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
  letterId: 'msg-1',
  letterTypeId: 'complaint',
  legalTaskId: 1,
  letterCount: 1,
}

function renderCard(task: KanbanTask) {
  return render(
    <MemoryRouter>
      <KanbanCard task={task} lawyers={[]} letterTypes={[]} editableLetterTypes={[]} />
    </MemoryRouter>
  )
}

describe('KanbanCard without a client', () => {
  it('shows a dash instead of a client name', () => {
    renderCard({ ...baseTask, clientId: null, clientCode: null, clientName: null })
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('unidentified')).not.toBeInTheDocument()
  })

  it('keeps the link back to the correspondence', () => {
    renderCard({ ...baseTask, clientId: null, clientCode: null, clientName: null })
    expect(screen.getByText('TASK-1')).toBeInTheDocument()
  })

  it('still shows the client when there is one', () => {
    renderCard(baseTask)
    expect(screen.getByText('Test Client')).toBeInTheDocument()
    expect(screen.getByText('CL-00010')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })
})
