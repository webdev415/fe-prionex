import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { useTrackEvent } from '@/features/operatorAnalytics'

/**
 * Records a client card being opened, and bounces an id no service can hold.
 *
 * Where the operator came from. The destination cannot work this out for
 * itself — React Router does not expose the previous route and
 * `document.referrer` is empty for client-side navigation — so the three
 * entry points named in the requirement tag themselves with `?from=`.
 * A query param rather than router state because the dialer link opens in a
 * new tab, which router state does not survive.
 *
 * These three are the entry points worth recording. There are ~49 places
 * that link to a client card; the rest are not tracked at all, so an open
 * from one of them produces no event rather than an event that cannot say
 * where it came from. The feed therefore answers "who opened this from the
 * list, search or dialer", not "who opened this" -- a reload or a pasted URL
 * carries no `from` either and is likewise silent.
 */
export function useClientCardOpenTracking(
  id: string | undefined,
  trackEvent: ReturnType<typeof useTrackEvent>
): void {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const cardOpenOrigin = useMemo(() => {
    const from = searchParams.get('from')
    return from === 'list' || from === 'search' || from === 'dialer' ? from : null
  }, [searchParams])

  const lastTrackedCardOpen = useRef<string | null>(null)

  useEffect(() => {
    if (!id) return
    const numericId = Number(id)
    // Client IDs are PostgreSQL INTEGER (int32, max 2_147_483_647) across all
    // services that consume this ID downstream. An out-of-range value (e.g.
    // a 13-digit Date.now()-style value from a stale URL or a paste error)
    // would 500 every backend call AND poison the analytics tracking_events
    // pipeline (its client_id column is also int32). Guard at the boundary:
    // bounce the operator back to the list with a toast instead of letting
    // the bad value spread.
    if (!Number.isFinite(numericId) || numericId < 1 || numericId > 2147483647) {
      toast.error(`Invalid client ID: ${id}`)
      navigate('/dashboard/clients', { replace: true })
      return
    }

    // Drop `?from=` on every run, before the once-per-card check below. It is
    // a one-shot signal, not state: leaving it in the address bar means a
    // copied or bookmarked link claims an origin it did not come from, and a
    // refresh re-reports it. Re-opening the client already on screen -- the
    // same client picked again in search -- stops at that check, so a strip
    // placed after it never ran and the param stayed. `replace` so it does not
    // add a history entry the back button lands on. The origin itself was read
    // at render, so dropping it here does not lose it for the event below.
    if (searchParams.has('from')) {
      const next = new URLSearchParams(searchParams)
      next.delete('from')
      setSearchParams(next, { replace: true })
    }

    // Once per card, not once per effect run. `trackEvent` and `navigate` are
    // both in the dependency list and both change identity, and StrictMode
    // double-invokes effects in development — without this guard a single open
    // recorded three to six times, milliseconds apart. The validation above
    // stays outside the guard: a bad id must bounce on every run.
    if (lastTrackedCardOpen.current === id) return
    lastTrackedCardOpen.current = id
    if (cardOpenOrigin) {
      trackEvent('client_card_open', {
        clientId: numericId,
        meta: { client_id: id, origin: cardOpenOrigin },
      })
    }
  }, [id, trackEvent, navigate, cardOpenOrigin, searchParams, setSearchParams])
}
