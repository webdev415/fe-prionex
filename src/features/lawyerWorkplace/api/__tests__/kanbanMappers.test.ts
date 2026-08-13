import { describe, expect, it, vi } from 'vitest'
import {
  buildKanbanColumnMovePatch,
  mapLegalKanbanItemToTask,
  matchesDeadlineFilter,
} from '../kanbanMappers'
import type { KanbanTask } from '@/pages/LawyerWorkplace/kanban/kanbanData'
import type { LegalKanbanTaskItem } from '../types'
import {
  isLegalDueDateOverdue,
  legalDefaultDueDateIso,
  legalDueCalendarDay,
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

describe('mapLegalKanbanItemToTask — column resolution', () => {
  it('routes a real non-legacy prod letter type to in_progress, not "Не визначено"', () => {
    // Regression: prod letter types (e.g. type_1785239278754 / УБКІ) are not in
    // the legacy KNOWN_TYPES set. They must NOT collapse to the "not_defined" column.
    const task = mapLegalKanbanItemToTask(
      { ...baseItem, letter_type_id: 'type_1785239278754', status: 'pending', is_overdue: false },
      [],
      TZ
    )
    expect(task.columnId).toBe('in_progress')
  })

  it('routes a real non-legacy letter type to overdue when past due', () => {
    const task = mapLegalKanbanItemToTask(
      { ...baseItem, letter_type_id: 'type_1785239278754', status: 'pending', is_overdue: true },
      [],
      TZ
    )
    expect(task.columnId).toBe('overdue')
  })

  it('keeps letters with no letter type at all in "not_defined"', () => {
    const task = mapLegalKanbanItemToTask(
      { ...baseItem, letter_type_id: null, status: 'pending' },
      [],
      TZ
    )
    expect(task.columnId).toBe('not_defined')
  })
})

// The card, the deadline filter and the CSV export each decide which calendar
// day a deadline falls on. Before KAN-1000 all three read the offset-less wire
// value the same wrong way and so agreed with each other; fixing only the card
// would have left them disagreeing by a day.
describe('matchesDeadlineFilter (offset-less wire values)', () => {
  const dueTask = (deadline: string): KanbanTask => ({
    ...baseTask,
    deadline,
    columnId: 'in_progress',
  })

  it('places a late-evening deadline on the profile-timezone day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T09:00:00Z'))
    // 22:00 UTC on Aug 31 is 01:00 on Sep 1 in Kyiv, so it is out of this month.
    expect(legalDueCalendarDay('2026-08-31T22:00:00', TZ)).toBe('2026-09-01')
    expect(matchesDeadlineFilter(dueTask('2026-08-31T22:00:00'), 'this_month', TZ)).toBe(false)
    expect(matchesDeadlineFilter(dueTask('2026-08-31T12:00:00'), 'this_month', TZ)).toBe(true)
    vi.useRealTimers()
  })

  it('decides from the same day the card renders', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T09:00:00Z'))
    for (const stored of [
      '2026-08-19T21:00:00',
      '2026-08-20T00:30:00',
      '2026-08-31T12:00:00',
      '2026-08-31T22:00:00',
      '2026-09-01T08:00:00',
    ]) {
      const day = legalDueCalendarDay(stored, TZ)
      const withinMonth = day >= '2026-08-20' && day <= '2026-08-31'
      expect(matchesDeadlineFilter(dueTask(stored), 'this_month', TZ)).toBe(withinMonth)
    }
    vi.useRealTimers()
  })
})
