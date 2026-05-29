import { getClients } from '@/features/clients/api/clientApi'

/** Matches messaging-service ``MESSAGING_CAMPAIGN_RECIPIENT_CAP`` default. */
export const BULK_MESSAGING_RECIPIENT_CAP = 50_000

/** Client-service ``GET /clients`` allows at most 100 per page (``MAX_PAGE_SIZE``). */
const FETCH_PAGE_SIZE = 100

/**
 * Load every client id matching the current list filters (all pages).
 * Used when the user selects "all" on a filtered client list.
 */
export async function fetchFilteredClientIds(
  baseParams: Record<string, unknown>,
  excludedIds: ReadonlySet<number>
): Promise<number[]> {
  const ids: number[] = []
  let skip = 0

  while (ids.length < BULK_MESSAGING_RECIPIENT_CAP) {
    const response = await getClients({
      ...baseParams,
      skip,
      limit: FETCH_PAGE_SIZE,
    })

    if (!response.items.length) {
      break
    }

    for (const client of response.items) {
      if (!excludedIds.has(client.id)) {
        ids.push(client.id)
      }
      if (ids.length >= BULK_MESSAGING_RECIPIENT_CAP) {
        return ids
      }
    }

    if (skip + response.items.length >= response.total) {
      break
    }
    skip += FETCH_PAGE_SIZE
  }

  return ids
}
