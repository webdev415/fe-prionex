/**
 * Pure helpers for client-list segment filter UI.
 */

/**
 * Format segment row meta for the client-list filter:
 * "1240 clients · updated at 14:32" (or just the count when never refreshed).
 */
export function formatSegmentFilterMeta(
  segment: {
    cached_client_count?: number
    last_refreshed_at?: string
  },
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const count = segment.cached_client_count ?? 0
  const clientsLabel = t('pages.clients.modals.tagsDropdown.segmentClients', {
    count,
  })
  if (!segment.last_refreshed_at) {
    return clientsLabel
  }
  const refreshed = new Date(segment.last_refreshed_at)
  if (Number.isNaN(refreshed.getTime())) {
    return clientsLabel
  }
  const time = refreshed.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return t('pages.clients.modals.tagsDropdown.segmentMeta', {
    clients: clientsLabel,
    time,
  })
}
