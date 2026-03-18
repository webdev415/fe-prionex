import api from '@/lib/api'
import type {
  OriginateCallRequest,
  OriginateCallResponse,
  CallDetail,
  CallHistoryFilters,
  CallHistoryResponse,
  UpdateCallOutcomeRequest,
  AMIHealthResponse,
  IncomingCallData,
} from '../types'

// Use same base URL as other services - all requests go through Kong Gateway
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

class CallService {
  async originateCall(request: OriginateCallRequest): Promise<OriginateCallResponse> {
    const response = await api.post(`${API_BASE_URL}/api/v1/calls/originate`, request)
    return response.data
  }

  async getCallDetails(callId: string): Promise<CallDetail> {
    const response = await api.get(`${API_BASE_URL}/api/v1/calls/${callId}`)
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
}

export const callService = new CallService()
