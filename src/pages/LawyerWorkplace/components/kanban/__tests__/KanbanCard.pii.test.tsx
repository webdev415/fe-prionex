/**
 * KAN-KB-54 — the markup of `pages/LawyerWorkplace`, phase 3.3.
 *
 * The whole section writes client names as `clientName`, which is why the static
 * audit reported nothing here until the dictionary learned that spelling. So the
 * section is the one where a rendered assertion earns the most: the source-level
 * rule that covers it is the newest and the least proven.
 */

import { describe, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import type { KanbanTask } from '../../../kanban/kanbanData'
import { KanbanCard } from '../KanbanCard'
import { expectObscured, expectNotObscured } from '@/test/piiHelpers'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const TASK: KanbanTask = {
  id: 'TASK-9',
  taskId: 9,
  type: 'complaint',
  title: 'Скарга на нарахування',
  clientCode: 'CL-00010',
  clientName: 'Іваненко Іван Іванович',
  clientId: 10,
  deadline: null,
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 42,
  columnId: 'in_progress',
  letterId: 'msg-1',
  letterTypeId: 'complaint',
  legalTaskId: 9,
  letterCount: 1,
}

function renderCard(task: KanbanTask = TASK) {
  render(
    <MemoryRouter>
      <KanbanCard task={task} lawyers={[]} letterTypes={[]} editableLetterTypes={[]} />
    </MemoryRouter>
  )
}

describe('LawyerWorkplace PII markup — KanbanCard', () => {
  it("masks the client's name", () => {
    renderCard()
    expectObscured(screen.getByText(TASK.clientName!))
  })

  it('leaves the client code readable', () => {
    // The code is what keeps a card identifiable in a replay once the name is
    // asterisks. Masking both would leave a board of indistinguishable cards,
    // which is `privateMode` by another route.
    renderCard()
    expectNotObscured(screen.getByText(TASK.clientCode!))
  })

  it('leaves the task title readable', () => {
    renderCard()
    expectNotObscured(screen.getByText(TASK.title))
  })

  it('marks the name in the no-link variant as well', () => {
    // The card renders the name twice, under two different branches: with a link
    // when the client is identified, without one when they are not. A test that
    // only ever saw the first branch would pass on markup that covers half the
    // board.
    renderCard({ ...TASK, clientId: null })
    expectObscured(screen.getByText(TASK.clientName!))
  })
})
