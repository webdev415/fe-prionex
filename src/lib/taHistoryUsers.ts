import type { OperatorUser } from '@/features/users'

/**
 * Whose TA records a TA History request should cover.
 *
 * Three answers, not two. "Nobody" has to be sayable: the tab's page-level
 * scope and its Employee picker can select disjoint sets — pick a colleague on
 * "All actions", switch to "My actions" — and the honest answer is then an
 * empty result, not an unfiltered one.
 *
 * Returning `undefined` for that case is what caused KAN-1211: downstream an
 * absent user filter means *every* user, so "show nobody" rendered as "show
 * everyone" and an operator saw their colleagues' records.
 *
 * The sibling Interaction History tab answers the same question the same way;
 * see `resolveInteractionUsers` in `interactionsUrlState.ts`.
 */
export type ResolvedTaHistoryUsers =
  | { kind: 'all' }
  | { kind: 'ids'; ids: number[] }
  | { kind: 'empty'; reason: EmptyReason }

/**
 * Why nobody matched. The screen has three different things to say, and
 * choosing between them from the raw URL state gets it wrong: a scope that
 * resolves to nobody carries no department and no employee, so it would be
 * reported as an employee problem when none is selected.
 */
export type EmptyReason =
  /** The page-level scope itself covers no one — no group, or no department. */
  | 'scope'
  /** The chosen department has no operators in this project. */
  | 'department'
  /** The chosen employees all fall outside the scope. */
  | 'filter'

interface TaHistoryUserSelection {
  departmentId: number | null
  employeeIds: number[]
}

/**
 * Which of the tab's own pickers the page-level scope has taken away.
 *
 * A picker the scope disables is not merely greyed out — its stored value stops
 * applying. "My actions" disables both, so a colleague left selected on "All
 * actions" must be ignored there, not intersected with: the operator cannot see
 * or clear that selection from this tab, so honouring it would strand them on an
 * empty screen with no way out.
 */
interface DisabledPickers {
  employeePickerDisabled?: boolean
  departmentPickerDisabled?: boolean
}

export function resolveTaHistoryUsers(
  selection: TaHistoryUserSelection,
  operators: OperatorUser[],
  scopedUserIds: number[] | undefined,
  disabled: DisabledPickers = {}
): ResolvedTaHistoryUsers {
  // The tab's own pickers first, skipping any the scope has taken away.
  // Department wins over the employee list, matching the filter bar, which
  // clears one when the other is set.
  const departmentId = disabled.departmentPickerDisabled ? null : selection.departmentId
  const employeeIds = disabled.employeePickerDisabled ? [] : selection.employeeIds

  let picked: number[] | 'all' = 'all'
  if (departmentId != null) {
    picked = operators.filter((o) => o.department_id === departmentId).map((o) => o.id)
  } else if (employeeIds.length > 0) {
    picked = employeeIds
  }

  // No page-level scope: the pickers stand alone.
  if (scopedUserIds === undefined) {
    if (picked === 'all') return { kind: 'all' }
    return picked.length ? { kind: 'ids', ids: picked } : { kind: 'empty', reason: 'department' }
  }

  // A scope that resolves to nobody — "my" with no signed-in user, or a
  // department scope for someone who has no department.
  if (scopedUserIds.length === 0) return { kind: 'empty', reason: 'scope' }

  if (picked === 'all') return { kind: 'ids', ids: scopedUserIds }

  const withinScope = new Set(scopedUserIds)
  const intersected = picked.filter((id) => withinScope.has(id))
  if (intersected.length) return { kind: 'ids', ids: intersected }
  // Which picker produced the mismatch decides what the screen should say.
  return { kind: 'empty', reason: departmentId != null ? 'department' : 'filter' }
}

/** The `recorded_by_in` parameter for a resolution, or none when unrestricted. */
export function taHistoryRecordedBy(resolved: ResolvedTaHistoryUsers): number[] | undefined {
  return resolved.kind === 'ids' ? resolved.ids : undefined
}
