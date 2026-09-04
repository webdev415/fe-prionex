/** Deciding whether Payment History offers the copy-link button, and what
 *  happens when it is clicked.
 *
 *  Split out from the page so both decisions are testable: the page itself has
 *  no test harness, and getting either wrong is quiet rather than loud -- a
 *  button on a settled payment, or a click that copies an empty string over
 *  whatever the operator had on their clipboard.
 */

export interface EasyPayLinkRow {
  easypayMethod?: string | null
  easypayLink?: string | null
  status: string
}

/** A link is worth offering only while it can still be paid. */
export function canOfferEasyPayLink(payment: EasyPayLinkRow): boolean {
  return payment.easypayMethod != null && payment.status === 'pending'
}

export type EasyPayLinkAction = { kind: 'copy'; url: string } | { kind: 'unavailable' }

/** The two enablement conditions do not imply a stored link: the gateway call
 *  sits between creating the payment and saving the URL, so a payment can be
 *  pending, carry a tender, and have nothing to copy. Report that rather than
 *  writing an empty string. */
export function easypayLinkAction(payment: EasyPayLinkRow): EasyPayLinkAction {
  const url = payment.easypayLink?.trim()
  return url ? { kind: 'copy', url } : { kind: 'unavailable' }
}
