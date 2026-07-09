/**
 * useCallTranscript — fetches the AI transcript of one call (Ф1).
 *
 * Fetch is gated by `enabled` (the panel passes the modal `open` flag) so a
 * client card with N call rows fires zero transcript requests until a call
 * is actually opened. staleTime 1h — the nightly batch means a transcript
 * cannot change mid-session (reprocess is an admin night-op).
 */
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getCallTranscript, transcriptKeys } from '../api/transcriptService'

function statusOf(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined
}

export function useCallTranscript(callId: string | null | undefined, enabled = true) {
  const query = useQuery({
    queryKey: callId
      ? transcriptKeys.detail(callId)
      : ([...transcriptKeys.all, 'detail', 'pending'] as const),
    queryFn: () => getCallTranscript(callId as string),
    enabled: enabled && !!callId,
    staleTime: 60 * 60 * 1000,
    retry: (failureCount, error) => {
      const status = statusOf(error)
      // 404 = not processed yet, 403 = no permission — retrying won't help.
      if (status === 404 || status === 403) return false
      return failureCount < 2
    },
  })

  const errorStatus = statusOf(query.error)

  /** Call not processed yet (404) or still pending/failed on the brain (202). */
  const notReady = errorStatus === 404 || query.data?.state === 'not_ready'
  /** Server-side RBAC said no (`view_transcripts`). */
  const forbidden = errorStatus === 403

  return {
    ...query,
    transcript: query.data?.state === 'ready' ? query.data.transcript : undefined,
    review: query.data?.state === 'ready' ? (query.data.review ?? null) : null,
    notReady,
    forbidden,
    /** True only for real failures (network / 5xx), not 403/404. */
    isHardError: query.isError && !notReady && !forbidden,
  }
}
