import type { EmployeeCard } from '../types.card'

/**
 * Whether the card accepts changes.
 *
 * Two separate questions, and the answer is only yes to both. ``can_edit`` is
 * permission - whether this reader is allowed to write. A termination is the
 * record being closed, which nobody's permission reopens.
 *
 * It is asked here rather than folded into ``can_edit`` on the server, because
 * a flag answering both at once gets read as answering whichever one the
 * caller had in mind - and the termination section itself stays editable after
 * somebody has left, or a date recorded wrongly could never be corrected.
 *
 * Hiding the actions is a courtesy, not the rule: the service refuses a write
 * to a closed card with a 409 whether or not the interface offered one.
 */
export function mayWrite(card: EmployeeCard): boolean {
  return card.can_edit && card.termination === null
}
