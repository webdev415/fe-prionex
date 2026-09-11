import { api } from '@/lib/api'

/** Which store an entry came from. A failing one is named in `degraded`. */
export type ActivitySource = 'events' | 'audit' | 'calls'

export interface ActivityEntry {
  /** `source:rowId` — unique in the feed and stable across pages. */
  id: string
  ts: string
  source: ActivitySource
  kind: string
  operator_id: number | null
  operator_name: string | null
  summary: string | null
  detail: Record<string, unknown> | null
}

export interface ActivityLogResponse {
  client_id: number
  entries: ActivityEntry[]
  /** Sources that failed. The feed is incomplete when this is non-empty. */
  degraded: ActivitySource[]
  /**
   * Merged count across all three sources — what the page count is built on.
   *
   * `null` on pages after the first: the expensive half of that count is
   * skipped there, since the number cannot change within one view. Callers
   * keep what page one reported.
   */
  total: number | null
  page: number
  page_size: number
}

export interface ActivityLogFilters {
  fromTs?: string | null
  toTs?: string | null
  operatorId?: number | null
  page?: number
  pageSize?: number
}

/** Matches the endpoint's own default, so page one asks for what it returns. */
export const DEFAULT_PAGE_SIZE = 50

/**
 * The deepest the endpoint will read, in rows — its `_MAX_FETCH`.
 *
 * Building a page means fetching everything up to it from each source, so the
 * work grows with depth and the endpoint refuses to go past this. Mirrored
 * here so the pagination control offers only pages that can actually load:
 * derived from `total` alone it advertised 301 pages against a ceiling of 200,
 * and every page past that answered 422.
 *
 * Older entries stay reachable through the date filter, which makes them the
 * newest rows of a smaller set.
 */
export const MAX_PAGED_ENTRIES = 10_000

export const activityLogApi = {
  get: (clientId: number, filters: ActivityLogFilters = {}): Promise<ActivityLogResponse> => {
    // Unset filters are omitted rather than sent as null: axios serialises null
    // to an empty string, which the endpoint rejects as an invalid datetime.
    const params: Record<string, string | number> = {}
    if (filters.fromTs) params.from_ts = filters.fromTs
    if (filters.toTs) params.to_ts = filters.toTs
    if (filters.operatorId != null) params.operator_id = filters.operatorId
    params.page = filters.page ?? 1
    params.page_size = filters.pageSize ?? DEFAULT_PAGE_SIZE

    return api
      .get<ActivityLogResponse>(`/api/v1/clients/${clientId}/activity-log`, { params })
      .then((r) => r.data)
  },
}
