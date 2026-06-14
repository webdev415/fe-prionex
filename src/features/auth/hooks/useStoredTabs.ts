/**
 * KAN-585 — React Query hooks for the tab snapshot.
 *
 * - `useStoredTabs` is called by GuestRoute right after login to fetch
 *   the snapshot. If the server returns empty (no snapshot, or Redis
 *   error → graceful empty fallback), GuestRoute skips the modal and
 *   falls through to KAN-601's normal navigation.
 * - `useConsumeSnapshot` is called from the modal's onRestore and
 *   onStartFresh handlers to delete the snapshot once the user has
 *   made a choice.
 */

import { useMutation, useQuery } from '@tanstack/react-query'

import {
  consumeSnapshot,
  fetchSnapshot,
  type TabSnapshotResponse,
} from '@/features/auth/api/tabSessionApi'

/**
 * Fetches the user's last-session tab snapshot.
 *
 * `retry: false` — if Redis is down, the BE returns an empty list
 * gracefully (catches RedisError). Retrying would pile up requests
 * against a broken backend without helping the user.
 *
 * `staleTime: 0` — always refetch on mount post-login, since the
 * snapshot state is session-relative and shouldn't be cached across
 * authentications.
 */
export function useStoredTabs(options: { enabled: boolean }) {
  return useQuery<TabSnapshotResponse>({
    queryKey: ['kan585', 'storedTabs'],
    queryFn: fetchSnapshot,
    enabled: options.enabled,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

/**
 * Deletes the snapshot (DEL key in Redis). Idempotent — server returns
 * { status: 'deleted' } whether or not the key existed.
 */
export function useConsumeSnapshot() {
  return useMutation({ mutationFn: consumeSnapshot })
}
