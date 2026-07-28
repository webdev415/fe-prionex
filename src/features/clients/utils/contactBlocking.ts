/**
 * Contact channel-blocking helpers (KAN-422 / KAN-804 follow-up).
 *
 * A contact tag can mark a contact as blocked for a channel. The backend
 * aggregates active tags into per-contact flags plus human-readable reason
 * strings, composed as:
 *   "Calls blocked: <tag>", "SMS blocked: <tag>", "Spam blocked: <tag>"
 * (see contact_tag_service.compute_blocking_flags).
 *
 * These helpers are the single source of truth for deciding when the Call /
 * Message action icons must be disabled and what tooltip to show — so every
 * place a contact row/card is rendered (Phones block, Recommenders tab, Related
 * tags tab) behaves identically regardless of which view is live.
 */

export type ContactBlockingFlags = {
  blocks_calls: boolean
  blocks_sms: boolean
  blocks_spam: boolean
  reasons: string[]
}

/** A call is blocked when the contact has an active blocks_calls tag. */
export function isCallBlocked(blocking?: ContactBlockingFlags | null): boolean {
  return Boolean(blocking?.blocks_calls)
}

/**
 * A message (SMS / Viber) is blocked when the contact has an active blocks_sms
 * tag.  blocks_spam governs the "Spam calls" option in the call dialog, not
 * the Message action icon.
 */
export function isMessageBlocked(blocking?: ContactBlockingFlags | null): boolean {
  return Boolean(blocking?.blocks_sms)
}

function pickReasons(reasons: string[] | undefined, prefixes: string[]): string {
  if (!reasons?.length) return ''
  const lower = prefixes.map((p) => p.toLowerCase())
  return reasons.filter((r) => lower.some((p) => r.toLowerCase().startsWith(p))).join('; ')
}

/** Tooltip text naming the tag(s) that block calls (empty if none). */
export function callBlockReason(blocking?: ContactBlockingFlags | null): string {
  return pickReasons(blocking?.reasons, ['calls blocked'])
}

/** Tooltip text naming the tag(s) that block messages (empty if none). */
export function messageBlockReason(blocking?: ContactBlockingFlags | null): string {
  return pickReasons(blocking?.reasons, ['sms blocked'])
}
