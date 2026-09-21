import { useEffect, useState } from 'react'

import type { TAInteraction } from '../api/types'

/**
 * Parse a backend timestamp as the UTC instant it is.
 *
 * The API writes `created_at` with python's naive `datetime.utcnow()`, so the
 * value arrives WITHOUT a zone marker — `2026-09-21T07:41:20`. ECMAScript reads
 * a date-time in that form as LOCAL time, which silently shifts the instant by
 * the viewer's offset:
 *
 *   Europe/Kyiv (UTC+3) — parsed 3h EARLY, so a five-minute window reads as
 *     closed from the moment the record is saved and the button never appears.
 *   America/* (UTC-5…-8) — parsed hours LATE, so the button lingers long after
 *     the server has closed the window and the next click returns 403.
 *
 * Appending `Z` is the convention the rest of the app already uses for these
 * timestamps (see `formatDateTime` in `@/lib/formatters`, which documents the
 * same DB convention). A value that DOES carry `Z` or an explicit ±HH:MM offset
 * is left alone, so this stays correct if the API ever starts sending one.
 *
 * Returns `NaN` for anything unparseable, which every caller already treats as
 * "no window".
 */
export function parseUtcTimestamp(value: string | null | undefined): number {
  if (!value) return NaN
  const normalized = value.replace(' ', 'T')
  const hasZone = normalized.endsWith('Z') || /[-+]\d{2}:\d{2}$/.test(normalized)
  return Date.parse(hasZone ? normalized : `${normalized}Z`)
}

/**
 * KAN-1110 — may the current user edit/delete this record right now?
 *
 * Two independent routes to `true`:
 *
 *  1. the user holds the edit/delete permission — unchanged behaviour, any
 *     record, no time limit;
 *  2. the record is theirs and its 5-minute window is still open.
 *
 * The window is judged per record, from that record's own
 * `self_edit_expires_at`. Saving three TAs a minute apart gives three
 * independent timers, so this must never look at "the newest interaction".
 *
 * The API re-checks on every request and is the real gate. This only decides
 * whether the button is on screen — so browser clock skew shifts when a button
 * disappears, it can never grant an edit the server would refuse.
 */
export function canMutateInteraction(
  interaction: Pick<TAInteraction, 'recorded_by' | 'self_edit_expires_at'>,
  currentUserId: number | null | undefined,
  hasPermission: boolean,
  now: number
): boolean {
  if (hasPermission) return true
  if (currentUserId == null || interaction.recorded_by == null) return false
  if (interaction.recorded_by !== currentUserId) return false
  const expiresAt = parseUtcTimestamp(interaction.self_edit_expires_at)
  if (Number.isNaN(expiresAt)) return false
  return now < expiresAt
}

/**
 * A clock that ticks until `deadline`, then stops.
 *
 * Without it the buttons stay on screen until something else re-renders the
 * list, and the operator's first action after five minutes is a click that
 * returns 403. Stopping at the deadline keeps an idle history tab from
 * re-rendering once a second forever.
 *
 * Takes a DEADLINE rather than an `enabled` flag so that no caller has to read
 * the clock during render to decide whether to tick. `Date.now()` is impure:
 * called while rendering it produces a value that changes on every re-render,
 * which React's rules forbid (and `react-hooks/purity` rejects). Here every
 * reading happens in the state initialiser or the interval callback, neither of
 * which is render. The caller only needs `parseUtcTimestamp`, which is pure.
 */
export function useNowUntil(deadline: number, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    // A deadline already past needs no timer: the `now` we hold is already
    // beyond it, so every window reads as closed.
    if (!Number.isFinite(deadline) || Date.now() >= deadline) return
    const id = window.setInterval(() => {
      const tick = Date.now()
      setNow(tick)
      if (tick >= deadline) window.clearInterval(id)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [deadline, intervalMs])
  return now
}
