/**
 * May a number clicked in the primary creditor's comment be dialled, and with
 * which spam setting (KAN-1212, review H1)?
 *
 * Extracted as a pure function for the same reason `callDialogGate` is: the
 * decision is a policy, and a policy that lives inline in a 6000-line page
 * cannot be tested and quietly disappears when the call site is refactored.
 *
 * `openOutboundCall` is NOT this gate. Its own guard covers the calling
 * WINDOW; a contact's blocking tags are checked by each caller — the phone
 * strip and the Recommenders tab both do it before they call. The comment path
 * did not, which let a number tagged "Do Not Call" be dialled from the comment
 * while the rest of the page locked it.
 */
import {
  callBlockReason,
  isCallBlocked,
  type ContactBlockingFlags,
} from '@/features/clients/utils/contactBlocking'

/** The contact fields the decision needs — a structural subset of
 *  `RecommenderContact`, so callers pass their existing rows unchanged. */
export type CommentCallContact = {
  spamAllowed?: boolean
  blocking?: ContactBlockingFlags
}

export type CommentCallDecision =
  | { allowed: false; reason: string }
  | { allowed: true; spamOverride: boolean | undefined }

/**
 * Every contact row holding this number decides together — not just the
 * phone-typed one.
 *
 * A number is coloured green on ANY contact type, and the same number is
 * routinely stored more than once («Рекомендувач» and «Мобільний телефон» can
 * both carry it). Consulting one row would let a Do Not Call tag on any of the
 * others be ignored, which is the hole this whole gate exists to close. So the
 * MOST RESTRICTIVE row wins: one blocked row refuses the call, one row that
 * forbids spam forbids it for all.
 */
export function commentCallDecision(
  contacts?: readonly CommentCallContact[] | null
): CommentCallDecision {
  const rows = contacts ?? []

  const blocked = rows.find((contact) => isCallBlocked(contact.blocking))
  if (blocked) {
    // Empty when the backend sent no reason string; the caller supplies the
    // generic label, because the wording is translated and this is not.
    return { allowed: false, reason: callBlockReason(blocked.blocking) }
  }

  return {
    allowed: true,
    // The CONTACTS' own flags, as the phone strip passes the single row's.
    // `undefined` when the number matches no contact at all, which leaves
    // openOutboundCall's fallback to the contact TYPE's default intact — the
    // right answer when there is no contact to have an opinion. `!== false`
    // rather than a bare truthiness check: the field is optional, and absent
    // means "not restricted", the same reading the type-level default uses.
    spamOverride: rows.length
      ? rows.every((contact) => contact.spamAllowed !== false && !contact.blocking?.blocks_spam)
      : undefined,
  }
}
