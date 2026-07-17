/**
 * Pure helpers for client-list segment filter UI.
 */

/**
 * Format segment row meta for the client-list filter:
 * "1240 clients · updated at 14:32" (or just the count when never refreshed).
 *
 * ``last_refreshed_at`` follows the same DB convention as ``formatDateTime``:
 * naive strings (no Z/offset) are UTC; display uses the user's IANA timezone
 * when provided, otherwise the browser local zone.
 */
export function formatSegmentFilterMeta(
  segment: {
    cached_client_count?: number
    last_refreshed_at?: string
  },
  t: (key: string, opts?: Record<string, unknown>) => string,
  timezone?: string | null
): string {
  const count = segment.cached_client_count ?? 0
  const clientsLabel = t('pages.clients.modals.tagsDropdown.segmentClients', {
    count,
  })
  if (!segment.last_refreshed_at) {
    return clientsLabel
  }

  let normalized = segment.last_refreshed_at.replace(' ', 'T')
  if (!normalized.endsWith('Z') && !/[-+]\d{2}:\d{2}$/.test(normalized)) {
    normalized += 'Z'
  }
  const refreshed = new Date(normalized)
  if (Number.isNaN(refreshed.getTime())) {
    return clientsLabel
  }

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }
  if (timezone) {
    try {
      timeOptions.timeZone = timezone
    } catch {
      // Invalid IANA zone — fall back to browser-local below
    }
  }

  let time: string
  try {
    time = refreshed.toLocaleTimeString('en-GB', timeOptions)
  } catch {
    time = refreshed.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  return t('pages.clients.modals.tagsDropdown.segmentMeta', {
    clients: clientsLabel,
    time,
  })
}
