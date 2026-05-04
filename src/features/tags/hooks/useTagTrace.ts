/**
 * useTagTrace — React Query hooks for the "Why this tag?" drawer.
 *
 * Backend hard-skips telemetry on errors, so 5xx here is a real outage —
 * we don't try to fall back to a partial view.
 */

import { useQuery } from '@tanstack/react-query'
import {
  getClientTagTrace,
  getRuleExecutions,
  type ClientTagTraceResponse,
  type RuleExecutionEntry,
} from '../api/tagTraceApi'

export const tagTraceKeys = {
  all: ['tag-trace'] as const,
  client: (clientId: number, tagCode?: string, limit?: number) =>
    [...tagTraceKeys.all, 'client', clientId, { tagCode, limit }] as const,
  rule: (ruleId: number, limit?: number) =>
    [...tagTraceKeys.all, 'rule', ruleId, { limit }] as const,
}

export function useClientTagTrace(
  clientId: number,
  options?: { tagCode?: string; limit?: number; enabled?: boolean }
) {
  return useQuery<ClientTagTraceResponse>({
    queryKey: tagTraceKeys.client(clientId, options?.tagCode, options?.limit),
    queryFn: () => getClientTagTrace(clientId, options),
    enabled: options?.enabled !== false && Number.isFinite(clientId) && clientId > 0,
    // Trace is read-mostly debug data — avoid hammering the endpoint when
    // operators leave the drawer open.
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

export function useRuleExecutions(ruleId: number, options?: { limit?: number; enabled?: boolean }) {
  return useQuery<RuleExecutionEntry[]>({
    queryKey: tagTraceKeys.rule(ruleId, options?.limit),
    queryFn: () => getRuleExecutions(ruleId, options?.limit),
    enabled: options?.enabled !== false && Number.isFinite(ruleId) && ruleId > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
