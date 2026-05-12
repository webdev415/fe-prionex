import { describe, expect, it } from 'vitest'
import {
  TASK_HISTORY_FILTERS_DEFAULT,
  readTaskHistoryUrlState,
  toTaskHistoryQuery,
  writeTaskHistoryUrlState,
  type TaskHistoryBarState,
} from '../lib/taskHistoryUrlState'

function roundtrip(state: TaskHistoryBarState): TaskHistoryBarState {
  const params = writeTaskHistoryUrlState(new URLSearchParams(), state)
  return readTaskHistoryUrlState(params)
}

describe('taskHistoryUrlState', () => {
  it('defaults round-trip cleanly', () => {
    const out = roundtrip(TASK_HISTORY_FILTERS_DEFAULT)
    expect(out).toEqual(TASK_HISTORY_FILTERS_DEFAULT)
  })

  it('omits default period and sort from the URL', () => {
    const params = writeTaskHistoryUrlState(new URLSearchParams(), TASK_HISTORY_FILTERS_DEFAULT)
    expect(params.get('period')).toBeNull()
    expect(params.get('sort')).toBeNull()
    expect(params.get('date_type')).toBeNull()
  })

  it('round-trips a fully populated state', () => {
    const state: TaskHistoryBarState = {
      period: 'today',
      customFromDate: undefined,
      customToDate: undefined,
      dateType: 'due',
      departmentId: 7,
      employeeIds: [],
      groupId: 3,
      subjectId: 42,
      priority: 'high',
      status: 'pending',
      sort: 'due_date_asc',
    }
    expect(roundtrip(state)).toEqual(state)
  })

  it('serialises employee_ids only when no department is set', () => {
    const state: TaskHistoryBarState = {
      ...TASK_HISTORY_FILTERS_DEFAULT,
      departmentId: 5,
      employeeIds: [10, 20],
    }
    const params = writeTaskHistoryUrlState(new URLSearchParams(), state)
    expect(params.get('department_id')).toBe('5')
    expect(params.getAll('employee_id')).toEqual([])
  })

  it('keeps employee_ids when department is null', () => {
    const state: TaskHistoryBarState = {
      ...TASK_HISTORY_FILTERS_DEFAULT,
      departmentId: null,
      employeeIds: [10, 20],
    }
    const params = writeTaskHistoryUrlState(new URLSearchParams(), state)
    expect(params.getAll('employee_id')).toEqual(['10', '20'])
  })

  it('drops unknown enum values silently when reading', () => {
    const params = new URLSearchParams()
    params.set('priority', 'banana')
    params.set('status', 'nope')
    params.set('sort', 'random')
    params.set('date_type', 'wat')
    const out = readTaskHistoryUrlState(params)
    expect(out.priority).toBeUndefined()
    expect(out.status).toBeUndefined()
    // Falls back to default for sort/date_type
    expect(out.sort).toBe('created_at_desc')
    expect(out.dateType).toBe('created')
  })

  it('toTaskHistoryQuery preserves date_type and propagates assignee ids', () => {
    const q = toTaskHistoryQuery(
      {
        ...TASK_HISTORY_FILTERS_DEFAULT,
        period: 'today',
        dateType: 'due',
        sort: 'due_date_desc',
        priority: 'high',
      },
      [1, 2, 3]
    )
    expect(q.date_type).toBe('due')
    expect(q.sort).toBe('due_date_desc')
    expect(q.priority).toBe('high')
    expect(q.assigned_to_user_ids).toEqual([1, 2, 3])
    expect(q.date_from).toBeDefined()
    expect(q.date_to).toBeDefined()
  })

  it('toTaskHistoryQuery returns no date bounds for custom period without dates', () => {
    const q = toTaskHistoryQuery(
      {
        ...TASK_HISTORY_FILTERS_DEFAULT,
        period: 'custom',
        customFromDate: undefined,
        customToDate: undefined,
      },
      undefined
    )
    expect(q.date_from).toBeUndefined()
    expect(q.date_to).toBeUndefined()
  })
})
