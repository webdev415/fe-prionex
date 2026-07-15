/**
 * Call QA transcript service (Ф1).
 *
 * Single read surface: `GET /api/v1/quality/transcripts/{call_id}` —
 * quality-service serves what the nightly brain run ingested. The UI never
 * talks to the brain directly (CALL_QA_INTEGRATION.md §1).
 *
 * Response contract (§9.2 of the pipeline spec):
 *   200 → { transcript, review|null }   (review stays null until Ф2)
 *   202 → { status: 'pending'|'failed' } — call known, transcript not ready
 *   404 → call not processed yet (today's call before the nightly run)
 *   403 → viewer lacks the `view_transcripts` permission
 */
import { api } from '@/lib/api'
import type { CallTranscriptDto, TranscriptQueryResult } from '../types'

export async function getCallTranscript(callId: string): Promise<TranscriptQueryResult> {
  const response = await api.get<CallTranscriptDto | { status?: string }>(
    `/api/v1/quality/transcripts/${callId}`
  )

  // 202 — the brain knows the call but hasn't produced a transcript yet.
  if (response.status === 202) {
    const body = response.data as { status?: string }
    return { state: 'not_ready', status: body?.status }
  }

  const dto = response.data as CallTranscriptDto
  // Defensive: a 200 without a transcript body is treated as not-ready
  // rather than crashing the panel (tolerant reader).
  if (!dto || !dto.transcript) {
    return { state: 'not_ready' }
  }
  return { state: 'ready', transcript: dto.transcript, review: dto.review ?? null }
}

export const transcriptKeys = {
  all: ['quality', 'transcripts'] as const,
  detail: (callId: string) => [...transcriptKeys.all, 'detail', callId] as const,
}
