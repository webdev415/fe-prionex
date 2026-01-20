/**
 * Call Service API Client Tests
 *
 * Tests for the CallService API client that handles call operations.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import axios from 'axios'
import { callService } from '../callService'
import type {
  OriginateCallRequest,
  CallHistoryFilters,
  UpdateCallOutcomeRequest,
} from '../../types'

// Base URL for deployed backend (matches VITE_API_BASE_URL in dev environment)
const API_BASE_URL = 'https://api.dev.crm-prionex.com'

vi.mock('axios')

describe('CallService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('originateCall', () => {
    it('should originate a call successfully', async () => {
      const mockRequest: OriginateCallRequest = {
        agent_extension: '1003',
        customer_number: '+380971234567',
        caller_id_name: 'CRM Call',
        metadata: { client_id: 123 },
      }

      const mockResponse = {
        data: {
          call_id: 'CALL-123',
          status: 'initiated',
          initiated_at: '2025-01-14T10:00:00Z',
        },
      }

      vi.mocked(axios.post).mockResolvedValue(mockResponse)

      const result = await callService.originateCall(mockRequest)

      expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/calls/originate`, mockRequest)
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle origination error', async () => {
      const mockRequest: OriginateCallRequest = {
        agent_extension: '1003',
        customer_number: '+380971234567',
      }

      const mockError = {
        response: {
          data: {
            message: 'Extension not configured',
          },
        },
      }

      vi.mocked(axios.post).mockRejectedValue(mockError)

      await expect(callService.originateCall(mockRequest)).rejects.toEqual(mockError)
    })
  })

  describe('getCallDetails', () => {
    it('should fetch call details successfully', async () => {
      const mockCallId = 'CALL-123'
      const mockResponse = {
        data: {
          call_id: 'CALL-123',
          agent_extension: '1003',
          customer_number: '+380971234567',
          state: 'active',
          initiated_at: '2025-01-14T10:00:00Z',
          talk_duration: 120,
        },
      }

      vi.mocked(axios.get).mockResolvedValue(mockResponse)

      const result = await callService.getCallDetails(mockCallId)

      expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/calls/CALL-123`)
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle call not found error', async () => {
      const mockCallId = 'CALL-INVALID'
      const mockError = {
        response: {
          status: 404,
          data: {
            message: 'Call not found',
          },
        },
      }

      vi.mocked(axios.get).mockRejectedValue(mockError)

      await expect(callService.getCallDetails(mockCallId)).rejects.toEqual(mockError)
    })
  })

  describe('getCallHistory', () => {
    it('should fetch call history without filters', async () => {
      const mockClientId = 123
      const mockResponse = {
        data: {
          calls: [
            {
              call_id: 'CALL-123',
              agent_extension: '1003',
              customer_number: '+380971234567',
              state: 'completed',
              initiated_at: '2025-01-14T10:00:00Z',
              total_duration: 180,
            },
          ],
          total: 1,
        },
      }

      vi.mocked(axios.get).mockResolvedValue(mockResponse)

      const result = await callService.getCallHistory(mockClientId)

      expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/calls/client/123`, {
        params: undefined,
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should fetch call history with filters', async () => {
      const mockClientId = 123
      const mockFilters: CallHistoryFilters = {
        outcome: 'answered',
        from_date: '2025-01-01',
        to_date: '2025-01-14',
        page: 1,
        limit: 10,
      }

      const mockResponse = {
        data: {
          calls: [],
          total: 0,
        },
      }

      vi.mocked(axios.get).mockResolvedValue(mockResponse)

      const result = await callService.getCallHistory(mockClientId, mockFilters)

      expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/calls/client/123`, {
        params: mockFilters,
      })
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle forbidden access error', async () => {
      const mockClientId = 123
      const mockError = {
        response: {
          status: 403,
          data: {
            message: 'Access denied',
          },
        },
      }

      vi.mocked(axios.get).mockRejectedValue(mockError)

      await expect(callService.getCallHistory(mockClientId)).rejects.toEqual(mockError)
    })
  })

  describe('updateCallOutcome', () => {
    it('should update call outcome successfully', async () => {
      const mockCallId = 'CALL-123'
      const mockOutcome: UpdateCallOutcomeRequest = {
        outcome: 'answered',
        disposition: 'promised_payment',
        notes: 'Client agreed to pay 5000 UAH',
        follow_up_date: '2025-11-25',
      }

      vi.mocked(axios.patch).mockResolvedValue({ data: {} })

      await callService.updateCallOutcome(mockCallId, mockOutcome)

      expect(axios.patch).toHaveBeenCalledWith(
        `${API_BASE_URL}/api/v1/calls/CALL-123/outcome`,
        mockOutcome
      )
    })

    it('should handle update validation error', async () => {
      const mockCallId = 'CALL-123'
      const mockOutcome: UpdateCallOutcomeRequest = {
        outcome: 'answered',
        notes: 'a'.repeat(6000), // Too long
      }

      const mockError = {
        response: {
          status: 413,
          data: {
            message: 'Notes exceed 5000 characters',
          },
        },
      }

      vi.mocked(axios.patch).mockRejectedValue(mockError)

      await expect(callService.updateCallOutcome(mockCallId, mockOutcome)).rejects.toEqual(
        mockError
      )
    })

    it('should handle call in progress error', async () => {
      const mockCallId = 'CALL-123'
      const mockOutcome: UpdateCallOutcomeRequest = {
        outcome: 'answered',
      }

      const mockError = {
        response: {
          status: 409,
          data: {
            message: 'Call still in progress',
          },
        },
      }

      vi.mocked(axios.patch).mockRejectedValue(mockError)

      await expect(callService.updateCallOutcome(mockCallId, mockOutcome)).rejects.toEqual(
        mockError
      )
    })
  })

  describe('getRecordingUrl', () => {
    it('should return correct recording URL', () => {
      const mockCallId = 'CALL-123'
      const expectedUrl = `${API_BASE_URL}/api/v1/calls/CALL-123/recording`

      const result = callService.getRecordingUrl(mockCallId)

      expect(result).toBe(expectedUrl)
    })
  })

  describe('getAMIHealth', () => {
    it('should fetch AMI health status successfully', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          ami_connected: true,
        },
      }

      vi.mocked(axios.get).mockResolvedValue(mockResponse)

      const result = await callService.getAMIHealth()

      expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/health/ami`)
      expect(result).toEqual(mockResponse.data)
    })

    it('should handle AMI connection down', async () => {
      const mockResponse = {
        data: {
          status: 'unhealthy',
          ami_connected: false,
        },
      }

      vi.mocked(axios.get).mockResolvedValue(mockResponse)

      const result = await callService.getAMIHealth()

      expect(result.ami_connected).toBe(false)
      expect(result.status).toBe('unhealthy')
    })

    it('should handle health check error', async () => {
      const mockError = {
        response: {
          status: 503,
          data: {
            message: 'Service unavailable',
          },
        },
      }

      vi.mocked(axios.get).mockRejectedValue(mockError)

      await expect(callService.getAMIHealth()).rejects.toEqual(mockError)
    })
  })
})
