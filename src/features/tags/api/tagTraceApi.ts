/**
 * Tag Trace API Client
 *
 * Backend: api-prionex services/tag/app/routers/trace.py (PR3 commit 3.10 BE).
 *
 * Two endpoints:
 *  - GET /api/v1/clients/{id}/tags/trace?tag_code=...&limit=...
 *    Unified timeline (assignment_log + rule_execution_log) for a client.
 *  - GET /api/v1/rules/{id}/executions?limit=...
 *    Last N execution-log entries for a single rule.
 */

import api from '@/lib/api'

export type TraceSource = 'assignment' | 'execution'

export type ProcessingStatus =
  | 'received'
  | 'dispatched'
  | 'matched'
  | 'not_matched'
  | 'action_skipped'
  | 'action_done'
  | 'error'
  | 'duplicate_skipped'
  | 'malformed'

export interface TraceTimelineEntry {
  source: TraceSource
  timestamp: string
  summary: string
  action?: string | null
  tag_id?: number | null
  tag_name?: string | null
  rule_id?: number | null
  rule_name?: string | null
  correlation_id?: string | null
  event_type?: string | null
  actor_type?: string | null
  actor_id?: number | null
  actor_display_name?: string | null
  reason?: string | null
  processing_status?: ProcessingStatus | string | null
  action_taken?: string | null
  error_message?: string | null
}

export interface ClientTagTraceResponse {
  client_id: number
  project_id: number
  tag_code?: string | null
  entries: TraceTimelineEntry[]
  rule_summary: Record<string, string>
}

export interface RuleExecutionEntry {
  id: number
  rule_id: number | null
  client_id: number | null
  event_id: string | null
  correlation_id: string | null
  source_service: string | null
  source_event_type: string | null
  processing_status: ProcessingStatus | string
  matched: boolean
  action_taken: string | null
  error_message: string | null
  created_at: string
}

export async function getClientTagTrace(
  clientId: number,
  options?: { tagCode?: string; limit?: number }
): Promise<ClientTagTraceResponse> {
  const params: Record<string, string | number> = {}
  if (options?.tagCode) params.tag_code = options.tagCode
  if (options?.limit) params.limit = options.limit
  const response = await api.get<ClientTagTraceResponse>(`/api/v1/clients/${clientId}/tags/trace`, {
    params,
  })
  return response.data
}

export async function getRuleExecutions(ruleId: number, limit = 50): Promise<RuleExecutionEntry[]> {
  const response = await api.get<RuleExecutionEntry[]>(`/api/v1/rules/${ruleId}/executions`, {
    params: { limit },
  })
  return response.data
}
