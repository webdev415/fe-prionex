/**
 * Whose records a TA History request covers (KAN-1211).
 *
 * The defect this pins: the page-level scope and the Employee picker can select
 * disjoint sets — pick a colleague on "All actions", switch to "My actions" —
 * and the old code answered `undefined`. Downstream an absent user filter means
 * *every* user, so "show nobody" rendered as "show everyone" and an operator
 * saw their colleagues' records.
 *
 * Every assertion is on the *kind*, never on truthiness: the whole bug was two
 * opposite meanings sharing one falsy value.
 */
import { describe, it, expect } from 'vitest'
import { resolveTaHistoryUsers, taHistoryRecordedBy } from '../taHistoryUsers'
import type { OperatorUser } from '@/features/users'

const ME = 11
const COLLEAGUE = 22
const OTHER = 33

const operators = [
  { id: ME, department_id: 1 },
  { id: COLLEAGUE, department_id: 1 },
  { id: OTHER, department_id: 2 },
] as OperatorUser[]

const nothingPicked = { departmentId: null, employeeIds: [] }

describe('resolveTaHistoryUsers — the reported bug', () => {
  it('answers "nobody" when the scope excludes the picked employee', () => {
    // "My actions" with a colleague left selected from the All actions tab.
    const resolved = resolveTaHistoryUsers(
      { departmentId: null, employeeIds: [COLLEAGUE] },
      operators,
      [ME]
    )
    expect(resolved).toEqual({ kind: 'empty' })
  })

  it('does not answer "no restriction" for that case', () => {
    // The actual regression: 'all' here is what showed every employee's records.
    const resolved = resolveTaHistoryUsers(
      { departmentId: null, employeeIds: [COLLEAGUE] },
      operators,
      [ME]
    )
    expect(resolved.kind).not.toBe('all')
    expect(taHistoryRecordedBy(resolved)).toBeUndefined()
  })

  it('shows only me once the filter is cleared', () => {
    // Step 5 of the report: clearing the filter makes the tab correct again.
    expect(resolveTaHistoryUsers(nothingPicked, operators, [ME])).toEqual({
      kind: 'ids',
      ids: [ME],
    })
  })

  it('keeps a picked employee who is inside the scope', () => {
    expect(
      resolveTaHistoryUsers({ departmentId: null, employeeIds: [ME, COLLEAGUE] }, operators, [ME])
    ).toEqual({ kind: 'ids', ids: [ME] })
  })
})

describe('resolveTaHistoryUsers — without a page scope', () => {
  it('is unrestricted when nothing is picked', () => {
    expect(resolveTaHistoryUsers(nothingPicked, operators, undefined)).toEqual({ kind: 'all' })
  })

  it('uses the picked employees as they are', () => {
    expect(
      resolveTaHistoryUsers({ departmentId: null, employeeIds: [COLLEAGUE] }, operators, undefined)
    ).toEqual({ kind: 'ids', ids: [COLLEAGUE] })
  })

  it('uses the department members', () => {
    expect(
      resolveTaHistoryUsers({ departmentId: 1, employeeIds: [] }, operators, undefined)
    ).toEqual({ kind: 'ids', ids: [ME, COLLEAGUE] })
  })

  it('answers "nobody" for a department with no operators', () => {
    expect(
      resolveTaHistoryUsers({ departmentId: 99, employeeIds: [] }, operators, undefined)
    ).toEqual({ kind: 'empty' })
  })
})

describe('resolveTaHistoryUsers — with a page scope', () => {
  it('narrows a department to the scope', () => {
    expect(resolveTaHistoryUsers({ departmentId: 1, employeeIds: [] }, operators, [ME])).toEqual({
      kind: 'ids',
      ids: [ME],
    })
  })

  it('answers "nobody" when the department lies outside the scope', () => {
    // The same defect as the reported one, on the department path. It was
    // masked before only because a separate guard happened to cover it.
    expect(resolveTaHistoryUsers({ departmentId: 2, employeeIds: [] }, operators, [ME])).toEqual({
      kind: 'empty',
    })
  })

  it('answers "nobody" when the scope itself resolves to no one', () => {
    // "my" with no signed-in user, or a department scope for someone with no
    // department.
    expect(resolveTaHistoryUsers(nothingPicked, operators, [])).toEqual({ kind: 'empty' })
  })

  it('prefers the department over the employee list, as the filter bar does', () => {
    expect(
      resolveTaHistoryUsers({ departmentId: 2, employeeIds: [ME] }, operators, undefined)
    ).toEqual({ kind: 'ids', ids: [OTHER] })
  })
})

describe('taHistoryRecordedBy', () => {
  it('sends the ids for a restricted answer', () => {
    expect(taHistoryRecordedBy({ kind: 'ids', ids: [ME] })).toEqual([ME])
  })

  it('sends nothing for an unrestricted answer', () => {
    expect(taHistoryRecordedBy({ kind: 'all' })).toBeUndefined()
  })

  it('sends nothing for "nobody" — the caller must not issue the request', () => {
    // Why this is safe: the tab disables the query on 'empty'. Without that it
    // would be the bug all over again, which is what the component test pins.
    expect(taHistoryRecordedBy({ kind: 'empty' })).toBeUndefined()
  })
})
