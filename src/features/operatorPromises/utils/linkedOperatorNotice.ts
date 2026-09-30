/**
 * What the `?opu=` notice says (see `OperatorPromisesTab`): three facts, told
 * apart — the second and the third used to share one sentence, which was
 * false for the second.
 *
 * - `highlightedOperator`: the row is on screen, marked and scrolled to.
 * - `highlightedOperatorHidden`: the operator IS in the period's roster, but
 *   the department sub-tab filters their row out — a click on «ТП» after
 *   arriving on «Всі», or a hand-edited `opd`. "No rows in this period" would
 *   be a lie here, the name is known, and the fix is one click away («Всі»).
 * - `highlightedOperatorMissing`: the period has no row for them at all —
 *   they collected nothing, or the id is nobody's. Only here is the bare id
 *   all there is to show.
 *
 * A pure function so the branch, the key AND the interpolation (name vs id)
 * are assertable without a dictionary — the component test sees only keys.
 */

import type { OperatorPromisesRow } from '../types'

export type LinkedOperatorNotice =
  | { key: 'highlightedOperator'; params: { name: string } }
  | { key: 'highlightedOperatorHidden'; params: { name: string } }
  | { key: 'highlightedOperatorMissing'; params: { id: number } }

/**
 * @param userId the linked operator (`?opu=`), already validated
 * @param linkedRow their row in the WHOLE roster, or null when the period has none
 * @param isVisible whether that row survives the active department sub-tab
 */
export function linkedOperatorNotice(
  userId: number,
  linkedRow: OperatorPromisesRow | null,
  isVisible: boolean
): LinkedOperatorNotice {
  if (linkedRow === null) {
    return { key: 'highlightedOperatorMissing', params: { id: userId } }
  }
  // A null `fio` is a directory that shipped nothing usable; the id is still
  // the operator, so it stands in for the name rather than «—».
  const name = linkedRow.fio ?? String(userId)
  return isVisible
    ? { key: 'highlightedOperator', params: { name } }
    : { key: 'highlightedOperatorHidden', params: { name } }
}
