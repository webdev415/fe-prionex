/**
 * Largest client id a tracking event can carry: `client_id` is a PostgreSQL
 * INTEGER in analytics and in every service a client id flows to.
 */
export const MAX_TRACKABLE_CLIENT_ID = 2_147_483_647

/**
 * A client id fit to send with a tracking event, or `null`.
 *
 * Anything else -- a stale 13-digit URL, `0`, a fraction, text -- is not a
 * client, and it is worse than useless in an event: analytics rejects the
 * whole batch that carries it, and the tracker re-queues a rejected batch, so
 * one bad id would stall every event the tab sends until a reload. `null` says
 * "no client" and lets the rest of the event through.
 */
export function toTrackableClientId(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const id = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(id) && id >= 1 && id <= MAX_TRACKABLE_CLIENT_ID ? id : null
}
