/**
 * The card's single column «Ответственный по платежу», folded from the feed's
 * two key-A columns — BY ID, then the name.
 *
 * The card computes `coalesce(assigned_user_id, recorded_by_user_id)` — an ID
 * — and only then joins that user's name. The feed sends the two ids and the
 * two names separately (owner's decision E: two explicit columns, so the axis
 * can be switched without a schema change), and the tab reproduces the card's
 * column for parity by folding the same way: pick the id first, THEN that
 * user's name, and the id itself when the name is null.
 *
 * ⚠️ NEVER `assigned_full_name ?? recorded_by_full_name`. A soft-deleted
 * assignee has a null NAME and a non-null ID (`GET /users/batch` filters
 * `is_deleted = false`, the id stays on the payment), so folding the names
 * would silently show the RECORDER for a payment that is assigned to somebody
 * else — a different person, presented as the responsible one. Folding the
 * ids shows the assignee's id, which is the truthful answer ("assigned to
 * employee 4711, who is no longer in the directory"). Zero rows differ today
 * (`assigned_user_id` is set on 7 446 of 7 446 August rows); the rule is
 * pinned in `__tests__/paymentResponsible.test.ts` for the day one does.
 */

import type { RecordedPaymentRow } from '../api/types'

export interface PaymentResponsible {
  /** The folded id — the card's `coalesce(assigned_user_id, recorded_by_user_id)`. */
  userId: number
  /** That user's name, or the id spelled out when the directory has no name. */
  label: string
  /** True when the label is the bare id — the UI can mark it as a deleted employee. */
  isIdOnly: boolean
}

/** Blank counts as missing, not as content (the tables' shared trim rule). */
function hasText(value: string | null): value is string {
  return !!value && value.trim() !== ''
}

/**
 * Fold the two key-A columns into the card's one, or `null` when the row
 * carries neither id (not a state the feed produces today — both ids are set
 * on 100 % of rows — but the schema allows it and «—» is the honest cell).
 */
export function foldPaymentResponsible(
  row: Pick<
    RecordedPaymentRow,
    'assigned_user_id' | 'assigned_full_name' | 'recorded_by_user_id' | 'recorded_by_full_name'
  >
): PaymentResponsible | null {
  // The ID decides which person the column names; the name is looked up on
  // THAT person only. `!= null` rather than `??` on purpose: an assignee with
  // id 0 does not exist, but a falsy check would read as "unassigned" — the
  // rule is about presence, not truthiness.
  if (row.assigned_user_id != null) {
    const name = row.assigned_full_name
    return hasText(name)
      ? { userId: row.assigned_user_id, label: name, isIdOnly: false }
      : { userId: row.assigned_user_id, label: String(row.assigned_user_id), isIdOnly: true }
  }
  if (row.recorded_by_user_id != null) {
    const name = row.recorded_by_full_name
    return hasText(name)
      ? { userId: row.recorded_by_user_id, label: name, isIdOnly: false }
      : {
          userId: row.recorded_by_user_id,
          label: String(row.recorded_by_user_id),
          isIdOnly: true,
        }
  }
  return null
}
