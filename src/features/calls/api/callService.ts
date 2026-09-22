import api from '@/lib/api'
import type {
  OriginateCallRequest,
  OriginateCallResponse,
  CallDetail,
  CallBatchItem,
  CallHistoryFilters,
  CallHistoryResponse,
  UpdateCallOutcomeRequest,
  AMIHealthResponse,
  IncomingCallData,
  BlockedCallAttemptResult,
  CallingWindowStatus,
} from '../types'

// Use same base URL as other services - all requests go through Kong Gateway
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:8000'

/**
 * The server answered 200 but the body carried fewer bytes than the
 * Content-Length it promised — the recording stream was cut mid-transfer
 * (KAN-1023: call-service sometimes drops the connection while proxying a
 * large recording). Playing such a blob silently truncates the call for the
 * trainer, so the fetch surfaces it as an explicit, retryable error instead.
 */
export class RecordingTruncatedError extends Error {
  readonly expectedBytes: number
  readonly receivedBytes: number

  constructor(expectedBytes: number, receivedBytes: number) {
    super(`Recording truncated: received ${receivedBytes} of ${expectedBytes} bytes`)
    this.name = 'RecordingTruncatedError'
    this.expectedBytes = expectedBytes
    this.receivedBytes = receivedBytes
  }
}

export interface FetchRecordingProgress {
  loadedBytes: number
  /** Total from Content-Length when the server sent one; null otherwise. */
  totalBytes: number | null
}

export interface FetchRecordingOptions {
  /** Cancels the download (dialog switched / player unmounted). */
  signal?: AbortSignal
  onProgress?: (progress: FetchRecordingProgress) => void
}

class CallService {
  /** Whether the project's calling window allows a call right now (KAN-1107). */
  async getCallingWindowStatus(clientId?: number | null): Promise<CallingWindowStatus> {
    const response = await api.get(`${API_BASE_URL}/api/v1/calls/calling-window/status`, {
      params: clientId != null ? { client_id: clientId } : undefined,
    })
    return response.data
  }

  async reportBlockedCallAttempt(clientId?: number | null): Promise<BlockedCallAttemptResult> {
    const response = await api.post(
      `${API_BASE_URL}/api/v1/calls/calling-window/blocked-attempts`,
      { client_id: clientId ?? null }
    )
    return response.data
  }

  async originateCall(request: OriginateCallRequest): Promise<OriginateCallResponse> {
    const response = await api.post(`${API_BASE_URL}/api/v1/calls/originate`, request)
    return response.data
  }

  async getCallDetails(callId: string): Promise<CallDetail> {
    const response = await api.get(`${API_BASE_URL}/api/v1/calls/${callId}`)
    return response.data
  }

  /**
   * Resolve many calls at once to their contacted number + client.
   * Powers the Dialogue Evaluation table (one request per page vs. N per-row
   * fetches). Unknown call_ids are omitted from the response.
   */
  async getCallsBatch(callIds: string[]): Promise<CallBatchItem[]> {
    if (callIds.length === 0) return []
    const response = await api.post(`${API_BASE_URL}/api/v1/calls/batch`, {
      call_ids: callIds,
    })
    return response.data
  }

  async getCallHistory(
    clientId: number,
    filters?: CallHistoryFilters
  ): Promise<CallHistoryResponse> {
    const response = await api.get(`${API_BASE_URL}/api/v1/calls/client/${clientId}`, {
      params: filters,
    })
    return response.data
  }

  async updateCallOutcome(callId: string, outcome: UpdateCallOutcomeRequest): Promise<void> {
    await api.patch(`${API_BASE_URL}/api/v1/calls/${callId}/outcome`, outcome)
  }

  getRecordingUrl(callId: string): string {
    return `${API_BASE_URL}/api/v1/calls/${callId}/recording`
  }

  /**
   * Fetches recording bytes with auth headers (required — native <audio src>
   * cannot send Bearer tokens).
   *
   * Verifies the body against Content-Length: a 200 whose stream was cut short
   * rejects with {@link RecordingTruncatedError} rather than handing back a
   * blob that plays as a shorter call. Only `size < expected` counts — with
   * `Content-Encoding` compression the decoded blob is legitimately larger
   * than the wire length, never smaller.
   */
  async fetchRecordingBlob(callId: string, options: FetchRecordingOptions = {}): Promise<Blob> {
    const response = await api.get(`/api/v1/calls/${callId}/recording`, {
      responseType: 'blob',
      timeout: 120_000,
      signal: options.signal,
      onDownloadProgress: options.onProgress
        ? (event) => {
            options.onProgress?.({
              loadedBytes: event.loaded,
              totalBytes: typeof event.total === 'number' && event.total > 0 ? event.total : null,
            })
          }
        : undefined,
    })
    const blob: Blob = response.data
    const expectedBytes = Number(response.headers?.['content-length'])
    if (Number.isFinite(expectedBytes) && expectedBytes > 0 && blob.size < expectedBytes) {
      throw new RecordingTruncatedError(expectedBytes, blob.size)
    }
    return blob
  }

  async getAMIHealth(): Promise<AMIHealthResponse> {
    const response = await api.get(`${API_BASE_URL}/health/ami`)
    return response.data
  }

  async getIncomingCallInfo(callId: string): Promise<IncomingCallData> {
    const response = await api.get(`${API_BASE_URL}/api/v1/calls/${callId}/incoming-info`)
    return response.data
  }

  async hangupCall(callId: string): Promise<{ status: string; message: string }> {
    const response = await api.post(`${API_BASE_URL}/api/v1/calls/${callId}/hangup`)
    return response.data
  }

  /**
   * Declines a ringing inbound call. Distinct from `hangupCall`: the backend
   * records the call as rejected by the operator rather than missed, and gates
   * on `receive_calls` so an inbound-only operator can decline.
   */
  /**
   * @param agentExtension which leg to drop. A queue rings every member at once,
   *   so without it the backend can only fall back to the extension recorded on
   *   the call — which is the first operator rung, not necessarily this one.
   */
  async rejectCall(
    callId: string,
    agentExtension?: string | null
  ): Promise<{ status: string; message: string }> {
    const response = await api.post(`${API_BASE_URL}/api/v1/calls/${callId}/reject`, {
      agent_extension: agentExtension ?? null,
    })
    return response.data
  }

  /**
   * Take a ringing inbound call.
   *
   * The operator's extension identifies which of the queue's ringing legs is
   * being answered — a queue rings every member at once, so without it the
   * backend can only fall back to the extension recorded on the call, which is
   * the first operator rung rather than necessarily this one.
   */
  async answerCall(
    callId: string,
    agentExtension?: string | null
  ): Promise<{ status: string; message: string }> {
    const response = await api.post(`${API_BASE_URL}/api/v1/calls/${callId}/answer`, {
      agent_extension: agentExtension ?? null,
    })
    return response.data
  }

  /** Park the caller, or take them back off hold. */
  async holdCall(
    callId: string,
    hold: boolean,
    agentExtension?: string | null
  ): Promise<{ status: string; message: string }> {
    const response = await api.post(`${API_BASE_URL}/api/v1/calls/${callId}/hold`, {
      hold,
      agent_extension: agentExtension ?? null,
    })
    return response.data
  }

  /**
   * Record which client this call is about.
   *
   * A number can resolve to several clients and the write-up goes to every one
   * the operator selected, but the call itself belongs on one card. Until this
   * is sent the record holds whichever match the lookup ranked first — a guess
   * made before the operator had seen anything.
   */
  async setCallPrimaryClient(callId: string, clientId: number): Promise<{ status: string }> {
    const response = await api.patch(`${API_BASE_URL}/api/v1/calls/${callId}/primary-client`, {
      client_id: clientId,
    })
    return response.data
  }
}

export const callService = new CallService()
