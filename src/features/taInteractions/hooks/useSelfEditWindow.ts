import { useEffect, useState } from 'react'

import type { TAInteraction } from '../api/types'

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
  const expiresAt = Date.parse(interaction.self_edit_expires_at)
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
 * which is render. The caller only needs `Date.parse`, which is pure.
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
