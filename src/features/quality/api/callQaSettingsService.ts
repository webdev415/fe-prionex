/**
 * Call QA settings service — the global «AI call analysis» switch.
 *
 * GET  /api/v1/quality/call-qa/settings — readable by any authenticated user
 * (client-card transcript panels need it to decide whether to render at all).
 * PUT  /api/v1/quality/call-qa/settings — requires `manage_call_qa` (403
 * otherwise; the admin toggle is additionally hidden behind PermissionGuard).
 *
 * While `transcripts_enabled` is false, quality-service answers
 * 403 {"detail":"call_qa_disabled"} on transcript endpoints — the UI hides
 * Call QA surfaces entirely instead of showing a permission error.
 */
import { api } from '@/lib/api'

export interface CallQaSettings {
  transcripts_enabled: boolean
}

export async function getCallQaSettings(): Promise<CallQaSettings> {
  const response = await api.get<CallQaSettings>('/api/v1/quality/call-qa/settings')
  return response.data
}

export async function updateCallQaSettings(input: CallQaSettings): Promise<CallQaSettings> {
  const response = await api.put<CallQaSettings>('/api/v1/quality/call-qa/settings', input)
  return response.data
}

export const callQaSettingsKey = ['quality', 'callQaSettings'] as const
