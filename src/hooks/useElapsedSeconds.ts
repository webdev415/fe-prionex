/**
 * useElapsedSeconds — whole seconds since `active` last became true.
 *
 * Built for the report tabs' loading state (Tasks/Kanbanboard#100): a slow
 * report (up to ~30 s on a cold production request) must show that it is
 * still working, so the caption gains an elapsed counter. The clock starts
 * when `active` turns true and is dropped back to 0 when it turns false, so
 * every new loading phase counts from zero.
 *
 * The value is derived from `Date.now()` on each tick rather than counted
 * tick by tick: a background browser tab throttles timers (to once a second
 * or less), and a tick counter would then lag behind the real wait.
 */

import { useEffect, useState } from 'react'

const TICK_MS = 1000

export function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) return
    const startedAt = Date.now()
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / TICK_MS))
    }, TICK_MS)
    return () => {
      clearInterval(id)
      // Reset on the way out, so the next loading phase cannot flash the
      // previous phase's last value before its own first tick.
      setElapsed(0)
    }
  }, [active])

  return active ? elapsed : 0
}
