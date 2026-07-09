import { describe, expect, it } from 'vitest'
import { buildKanbanColumnMovePatch } from '../kanbanMappers'
import type { KanbanTask } from '@/pages/LawyerWorkplace/kanban/kanbanData'
import {
  isLegalDueDateOverdue,
  legalDefaultDueDateIso,
  legalOverdueDueDateIso,
} from '../../utils/legalDueDate'

const baseTask: KanbanTask = {
  id: 'TASK-1',
  taskId: 1,
  type: 'complaint',
  title: 'Legal: Complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  deadline: legalDefaultDueDateIso(),
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 42,
  columnId: 'in_progress',
  letterId: 'letter-1',
}

describe('buildKanbanColumnMovePatch', () => {
  it('sets overdue due date when moving to overdue', () => {
    const patch = buildKanbanColumnMovePatch(baseTask, 'overdue')
    expect(patch.deadline).toBe(legalOverdueDueDateIso())
  })

  it('clears letter type when moving to not defined', () => {
    const patch = buildKanbanColumnMovePatch(baseTask, 'not_defined')
    expect(patch.clearLetterType).toBe(true)
  })

  it('bumps due date when moving overdue task to in progress', () => {
    const overdueTask = {
      ...baseTask,
      columnId: 'overdue' as const,
      deadline: '2020-01-01T10:00:00.000Z',
    }
    const patch = buildKanbanColumnMovePatch(overdueTask, 'in_progress')
    expect(patch.deadline).toBe(legalDefaultDueDateIso())
    expect(isLegalDueDateOverdue(patch.deadline ?? null)).toBe(false)
  })
})
