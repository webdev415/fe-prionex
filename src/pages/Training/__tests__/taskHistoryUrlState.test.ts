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
      departmentId: 7,
      employeeIds: [],
      authorIds: [11, 22],
      groupId: 3,
      subjectId: 42,
      priority: 'high',
      status: 'pending',
      dueFromDate: '2026-05-13',
      dueFromTime: '09:00',
      dueToDate: '2026-05-20',
      dueToTime: '17:30',
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

  it('serialises author_ids independently of department/employee', () => {
    const state: TaskHistoryBarState = {
      ...TASK_HISTORY_FILTERS_DEFAULT,
      departmentId: 5,
      authorIds: [99, 100],
    }
    const params = writeTaskHistoryUrlState(new URLSearchParams(), state)
    expect(params.get('department_id')).toBe('5')
    expect(params.getAll('author_id')).toEqual(['99', '100'])
  })

  it('drops unknown enum values silently when reading', () => {
    const params = new URLSearchParams()
    params.set('priority', 'banana')
    params.set('status', 'nope')
    params.set('sort', 'random')
    const out = readTaskHistoryUrlState(params)
    expect(out.priority).toBeUndefined()
    expect(out.status).toBeUndefined()
    expect(out.sort).toBe('created_at_desc')
  })

  it('toTaskHistoryQuery composes the due-date+time inputs', () => {
    const q = toTaskHistoryQuery(
      {
        ...TASK_HISTORY_FILTERS_DEFAULT,
        dueFromDate: '2026-05-13',
        dueFromTime: '09:00',
        dueToDate: '2026-05-13',
        dueToTime: '17:30',
      },
      undefined,
      undefined
    )
    expect(q.due_date_from).toBeDefined()
    expect(q.due_date_to).toBeDefined()
    // From should be earlier than To
    expect(new Date(q.due_date_from!).getTime()).toBeLessThan(new Date(q.due_date_to!).getTime())
  })

  it('toTaskHistoryQuery defaults missing times to start/end of day', () => {
    const q = toTaskHistoryQuery(
      {
        ...TASK_HISTORY_FILTERS_DEFAULT,
        dueFromDate: '2026-05-13',
        dueToDate: '2026-05-13',
      },
      undefined,
      undefined
    )
    const from = new Date(q.due_date_from!)
    const to = new Date(q.due_date_to!)
    expect(from.getHours()).toBe(0)
    expect(from.getMinutes()).toBe(0)
    expect(to.getHours()).toBe(23)
    expect(to.getMinutes()).toBe(59)
  })

  it('toTaskHistoryQuery propagates created_by_in', () => {
    const q = toTaskHistoryQuery(TASK_HISTORY_FILTERS_DEFAULT, undefined, [11, 22, 33])
    expect(q.created_by_in).toEqual([11, 22, 33])
  })

  it('toTaskHistoryQuery date_from/date_to from period filter created_at only', () => {
    const q = toTaskHistoryQuery(
      { ...TASK_HISTORY_FILTERS_DEFAULT, period: 'today' },
      undefined,
      undefined
    )
    expect(q.date_from).toBeDefined()
    expect(q.date_to).toBeDefined()
    // due_date_from/to should be untouched by the period filter
    expect(q.due_date_from).toBeUndefined()
    expect(q.due_date_to).toBeUndefined()
  })
})
