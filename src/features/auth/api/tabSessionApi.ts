/**
 * KAN-585 — API client for session restore endpoints.
 *
 * All endpoints are mounted under /api/v1/auth/me/tabs/* on auth-service.
 * The axios `api` instance already includes the JWT Authorization header
 * via the existing interceptor, so callers don't need to add it.
 */

import { api } from '@/lib/api'

export interface TabSnapshotResponse {
  urls: string[]
  count: number
}

/** Per-navigation upsert. Called by useTabTracker on every route change. */
export async function upsertTabUrl(tabId: string, url: string): Promise<void> {
  await api.put('/api/v1/auth/me/tabs/snapshot', { tab_id: tabId, url })
}

/**
 * Per-tab close. Called by useTabTracker only when its localStorage
 * counter determines this is a SINGLE-tab close (other tabs still alive).
 *
 * NOTE: when called during the unload sequence, the API client may be
 * unavailable — in that case useTabTracker uses fetch() with keepalive
 * directly rather than going through this function.
 */
export async function deleteTab(tabId: string): Promise<void> {
  await api.delete(`/api/v1/auth/me/tabs/${tabId}`)
}

/** Read the snapshot at login. Returns up to 15 URLs, newest first. */
export async function fetchSnapshot(): Promise<TabSnapshotResponse> {
  const res = await api.get<TabSnapshotResponse>('/api/v1/auth/me/tabs/last')
  return res.data
}

/**
 * Consume the snapshot. Called ONLY when the user clicks
 * "Restore Session" or "Start Fresh" on the next-login modal.
 *
 * Per Q1 lock, this is NOT called on logout or JWT expiry.
 */
export async function consumeSnapshot(): Promise<void> {
  await api.delete('/api/v1/auth/me/tabs/snapshot')
}
