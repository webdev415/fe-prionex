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
 *  pending, carry an EasyPay method, and have nothing to copy. Report that rather than
 *  writing an empty string. */
export function easypayLinkAction(payment: EasyPayLinkRow): EasyPayLinkAction {
  const url = payment.easypayLink?.trim()
  return url ? { kind: 'copy', url } : { kind: 'unavailable' }
}

/** Copy `text`, resolving to whether it actually reached the clipboard.
 *
 *  Two ways a copy fails, and they fail differently. A refusal rejects the
 *  promise: browsers gate clipboard writes on user activation and that grant
 *  expires, so a write after an awaited request can be turned down. Absence
 *  throws synchronously instead -- the API exists only in a secure context, so
 *  on a plain-http stand `navigator.clipboard` is undefined and `.writeText`
 *  is a call on nothing, which no rejection handler sees. Left unguarded in
 *  the save flow that throw escapes inside the mutation's onSuccess and takes
 *  the rest of the callback with it: the modal never closes.
 *
 *  One boolean covers both, because the operator needs the same thing either
 *  way: to be told the link is not on their clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const clipboard = navigator.clipboard
  if (!clipboard?.writeText) return false
  try {
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
