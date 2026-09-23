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
 * Not cached beyond the default: the operator places a call FROM this dropdown,
 * and a stale "Never" moments after dialling would be worse than a second
 * request. The query is a single indexed lookup and only runs while a panel is
 * open, so refetching on each open is cheap.
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
