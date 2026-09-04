import { api } from '@/lib/api'

/** Which store an entry came from. A failing one is named in `degraded`. */
export type ActivitySource = 'events' | 'audit' | 'calls'

export interface ActivityEntry {
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
}

export interface ActivityLogFilters {
  fromTs?: string | null
  toTs?: string | null
  operatorId?: number | null
  limit?: number
}

export const activityLogApi = {
  get: (clientId: number, filters: ActivityLogFilters = {}): Promise<ActivityLogResponse> => {
    // Unset filters are omitted rather than sent as null: axios serialises null
    // to an empty string, which the endpoint rejects as an invalid datetime.
    const params: Record<string, string | number> = {}
    if (filters.fromTs) params.from_ts = filters.fromTs
    if (filters.toTs) params.to_ts = filters.toTs
    if (filters.operatorId != null) params.operator_id = filters.operatorId
    params.limit = filters.limit ?? 200

    return api
      .get<ActivityLogResponse>(`/api/v1/clients/${clientId}/activity-log`, { params })
      .then((r) => r.data)
  },
}
