import { describe, expect, it } from 'vitest'
import { buildKanbanColumnMovePatch } from '../kanbanMappers'
import type { KanbanTask } from '@/pages/LawyerWorkplace/kanban/kanbanData'
import {
  isLegalDueDateOverdue,
  legalDefaultDueDateIso,
  legalOverdueDueDateIso,
} from '../../utils/legalDueDate'

const TZ = 'Europe/Kyiv'

const baseTask: KanbanTask = {
  id: 'TASK-1',
  taskId: 1,
  type: 'complaint',
  title: 'Legal: Complaint',
  clientCode: 'CL-00010',
  clientName: 'Test Client',
  deadline: legalDefaultDueDateIso(TZ),
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 42,
  columnId: 'in_progress',
  letterId: 'letter-1',
  letterTypeId: 'complaint',
}

describe('buildKanbanColumnMovePatch', () => {
  it('sets overdue due date when moving to overdue', () => {
    const patch = buildKanbanColumnMovePatch(baseTask, 'overdue', TZ)
    expect(patch.deadline).toBe(legalOverdueDueDateIso(TZ))
  })

  it('clears letter type when moving to not defined', () => {
    const patch = buildKanbanColumnMovePatch(baseTask, 'not_defined', TZ)
    expect(patch.clearLetterType).toBe(true)
  })

  it('bumps due date when moving overdue task to in progress', () => {
    const overdueTask = {
      ...baseTask,
      columnId: 'overdue' as const,
      deadline: '2020-01-01T10:00:00.000Z',
    }
    const patch = buildKanbanColumnMovePatch(overdueTask, 'in_progress', TZ)
    expect(patch.deadline).toBe(legalDefaultDueDateIso(TZ))
    expect(isLegalDueDateOverdue(patch.deadline ?? null, TZ)).toBe(false)
  })
})
