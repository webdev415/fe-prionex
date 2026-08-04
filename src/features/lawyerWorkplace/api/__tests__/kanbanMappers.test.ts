import { describe, expect, it } from 'vitest'
import { buildKanbanColumnMovePatch, mapLegalKanbanItemToTask } from '../kanbanMappers'
import type { KanbanTask } from '@/pages/LawyerWorkplace/kanban/kanbanData'
import type { LegalKanbanTaskItem } from '../types'
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
  clientId: 10,
  deadline: legalDefaultDueDateIso(TZ),
  closedAt: null,
  priority: 'medium',
  assigneeInitials: 'YD',
  assigneeName: 'Demchuk',
  assigneeUserId: 42,
  columnId: 'in_progress',
  letterId: 'letter-1',
  letterTypeId: 'complaint',
  legalTaskId: 1,
  letterCount: 1,
}

const baseItem: LegalKanbanTaskItem = {
  task_id: 7,
  message_id: 'letter-7',
  letter_type_id: 'complaint',
  title: 'Legal: Complaint',
  client_id: 10,
  client_name: 'Test Client',
  priority: 'normal',
  status: 'in_progress',
  due_date: legalDefaultDueDateIso(TZ),
  is_overdue: false,
  assigned_to_user_id: 42,
  assigned_to_username: 'Yurii Demchuk',
  completed_at: null,
  updated_at: null,
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

describe('mapLegalKanbanItemToTask — letter grouping', () => {
  it('exposes legalTaskId and defaults letterCount to 1 for ungrouped tasks', () => {
    const task = mapLegalKanbanItemToTask(baseItem, [], TZ)
    expect(task.legalTaskId).toBe(7)
    expect(task.letterCount).toBe(1)
  })

  it('carries the backend letter_count when the task groups several letters', () => {
    const task = mapLegalKanbanItemToTask({ ...baseItem, letter_count: 3 }, [], TZ)
    expect(task.letterCount).toBe(3)
  })

  it('keeps a standalone letter_count of 0 as-is (no letter linked)', () => {
    const task = mapLegalKanbanItemToTask({ ...baseItem, letter_count: 0 }, [], TZ)
    expect(task.letterCount).toBe(0)
  })
})
