/**
 * KAN-973 §4 — pre-select the phone from a very recent call, for hotkey launches.
 *
 * When an operator hangs up and immediately hits a hotkey to log the call, the
 * number they just spoke to is almost certainly the one they want. This picks
 * it, but only inside a short window — beyond that the connection is guesswork
 * and a wrong pre-selection is worse than none, because the operator may not
 * notice it was made for them.
 *
 * Hotkey-only by contract: the ticket is explicit that opening the modal from a
 * phone row or the header button keeps today's behaviour. Callers enforce that
 * by only consulting this on the hotkey path.
 *
 * Pure, like the rest of this folder — the interesting cases (clock skew, a
 * number that is not among the client's contacts, a call still in progress) are
 * all decidable from data, and none of them needs a rendered modal.
 */

/** The ticket's window: a call is "just now" for this long after it ends. */
export const RECENT_CALL_WINDOW_MINUTES = 10

/**
 * Comparison key for two phone numbers that may be written differently.
 *
 * The switchboard reports what it dialled (`+380501234567`); the client record
 * stores what someone typed (`050 123 45 67`). Comparing raw strings would miss
 * that these are one number.
 *
 * Digits only, then the last 9 — which is the subscriber part of a Ukrainian
 * number, so it survives the country code and trunk zero being present or not.
 * Shorter values (internal extensions) are compared whole.
 */
export function normalizePhoneKey(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length > 9 ? digits.slice(-9) : digits
}

/** The fields this needs from a call record. */
export interface RecentCallLike {
  customer_number?: string | null
  ended_at?: string | null
}

/**
 * The client contact matching the most recent call, or `null`.
 *
 * Returns the caller's own contact object rather than a string so the caller
 * keeps the stored spelling and any type information — the radio list compares
 * against the stored `contact_value`, so handing back the switchboard's
 * spelling would fail to check anything.
 *
 * Deliberate choices:
 *
 * * Ordering is by `ended_at`, not `initiated_at`. A long call that started
 *   earlier can still be the one that just finished.
 * * Calls with no `ended_at` are skipped. The ticket says "ended no more than
 *   10 minutes ago", and a call still in progress has not ended — the operator
 *   is presumably still on it.
 * * Only the single most recent call is considered. If its number is not one of
 *   the client's contacts, the result is `null` rather than falling back to an
 *   older call: silently pre-selecting a number from a different conversation
 *   is the wrong kind of helpful.
 * * A timestamp slightly in the future still counts. Server and browser clocks
 *   disagree by seconds routinely, and treating that as "not yet ended" would
 *   drop exactly the just-hung-up call this feature exists for.
 */
export function resolveRecentCallPhone<T extends { number: string }>(params: {
  calls: RecentCallLike[]
  phones: T[]
  nowMs: number
  windowMinutes?: number
}): T | null {
  const { calls, phones, nowMs, windowMinutes = RECENT_CALL_WINDOW_MINUTES } = params
  const windowMs = windowMinutes * 60_000

  let best: { endedMs: number; number: string } | null = null
  for (const call of calls) {
    if (!call.ended_at || !call.customer_number) continue

    const endedMs = Date.parse(call.ended_at)
    if (Number.isNaN(endedMs)) continue
    if (nowMs - endedMs > windowMs) continue

    if (!best || endedMs > best.endedMs) {
      best = { endedMs, number: call.customer_number }
    }
  }
  if (!best) return null

  const key = normalizePhoneKey(best.number)
  if (!key) return null

  return phones.find((phone) => normalizePhoneKey(phone.number) === key) ?? null
}
