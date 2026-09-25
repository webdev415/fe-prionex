import { useQuery } from '@tanstack/react-query'
import { callService } from '../api/callService'
import type { LastCallByPhoneResponse } from '../types'

/**
 * When the given number was last called (KAN-1212).
 *
 * Feeds the "Останній дзвінок: …" line of the creditor-comment dropdown, which
 * shows a formatted instant or «Ніколи».
 *
 * Unwrapped rather than returning the raw query, the way `useCallingWindow`
 * does, and for a reason that matters here: an unresolved query has no
 * `last_call` at all, which is indistinguishable from a resolved
 * `last_call: null`. Collapsing both to a bare date would make the panel
 * announce "Never" about a number whose lookup is still in flight. `isLoading`
 * is what keeps those two apart, so it is returned beside the value rather
 * than left for each caller to remember.
 *
 * Opted OUT of the app's cache, explicitly (review M3). The app default is
 * `staleTime: QUERY.STALE_TIME` — five minutes — and this query is the one
 * place that cannot live with it: the operator places a call FROM this panel,
 * and reopening it would replay the pre-call answer, stating "Ніколи" about a
 * number they dialled a minute ago.
 *
 * `gcTime: 0` alongside `staleTime: 0` on purpose. `staleTime` alone refetches
 * on reopen but renders the CACHED value first, so the stale "Never" is still
 * shown for as long as the round trip takes. Dropping the entry instead means
 * a reopened panel says "…" rather than something untrue. React-query collects its
 * garbage on the next tick, not inside unmount, so this holds for a real
 * reopen (which costs a click) and not for a same-tick remount.
 *
 * Affordable: one indexed lookup, only while a panel is open.
 */
export function useLastCallByPhone(phone: string | null) {
  const enabled = Boolean(phone)

  const { data, isLoading, isError } = useQuery<LastCallByPhoneResponse>({
    // The number is the key: two panels opened for different numbers in the
    // same comment must not share an answer.
    queryKey: ['lastCallByPhone', phone],
    // Guarded by `enabled`, so the non-null assertion cannot fire with null.
    queryFn: () => callService.getLastCallByPhone(phone as string),
    enabled,
    refetchOnWindowFocus: false,
    // See the docstring: the app's 5-minute default is wrong for this one.
    staleTime: 0,
    gcTime: 0,
  })

  return {
    /** ISO instant of the last call, or null when there has never been one. */
    lastCallAt: data?.last_call?.initiated_at ?? null,
    /** RAW outcome — unlocalised; `classifyCallOutcome` owns the wording. */
    outcome: data?.last_call?.outcome ?? null,
    /** True only while a lookup is genuinely in flight for a real number. */
    isLoading: enabled && isLoading,
    isError,
  }
}
