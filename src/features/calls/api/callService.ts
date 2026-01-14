import axios from 'axios'
import type {
  OriginateCallRequest,
  OriginateCallResponse,
  CallDetail,
  CallHistoryFilters,
  CallHistoryResponse,
  UpdateCallOutcomeRequest,
  AMIHealthResponse,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8005'

class CallService {
  async originateCall(request: OriginateCallRequest): Promise<OriginateCallResponse> {
    const response = await axios.post(`${API_BASE_URL}/api/v1/calls/originate`, request)
    return response.data
  }

  async getCallDetails(callId: string): Promise<CallDetail> {
    const response = await axios.get(`${API_BASE_URL}/api/v1/calls/${callId}`)
    return response.data
  }

  async getCallHistory(
    clientId: number,
    filters?: CallHistoryFilters
  ): Promise<CallHistoryResponse> {
    const response = await axios.get(`${API_BASE_URL}/api/v1/calls/client/${clientId}`, {
      params: filters,
    })
    return response.data
  }

  async updateCallOutcome(callId: string, outcome: UpdateCallOutcomeRequest): Promise<void> {
    await axios.patch(`${API_BASE_URL}/api/v1/calls/${callId}/outcome`, outcome)
  }

  getRecordingUrl(callId: string): string {
    return `${API_BASE_URL}/api/v1/calls/${callId}/recording`
  }

  async getAMIHealth(): Promise<AMIHealthResponse> {
    const response = await axios.get(`${API_BASE_URL}/health/ami`)
    return response.data
  }
}

export const callService = new CallService()
