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
} from '../types'

// Use same base URL as other services - all requests go through Kong Gateway
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : 'http://localhost:8000'

class CallService {
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

  /** Fetches recording bytes with auth headers (required — native <audio src> cannot send Bearer tokens). */
  async fetchRecordingBlob(callId: string): Promise<Blob> {
    const response = await api.get(`/api/v1/calls/${callId}/recording`, {
      responseType: 'blob',
      timeout: 120_000,
    })
    return response.data
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
}

export const callService = new CallService()
