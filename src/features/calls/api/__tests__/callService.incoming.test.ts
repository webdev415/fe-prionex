import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'
import { callService } from '../callService'
import type { IncomingCallData } from '../../types'

// Match the API_BASE_URL from callService.ts (uses environment variable or default)
const API_BASE_URL = 'https://api.dev.crm-prionex.online'

vi.mock('axios')

describe('CallService - Incoming Call Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getIncomingCallInfo', () => {
    const callId = '123e4567-e89b-12d3-a456-426614174000'
    const mockIncomingCallData: IncomingCallData = {
      call_id: callId,
      customer_phone: '+380501234567',
      agent_extension: '1004',
      client_name: 'Коваленко Іван Петрович',
      loan_count: 2,
      total_debt: '8000.0',
      loans: [
        {
          loan_id: 456,
          contract_number: 'LOAN-2024-001',
          remaining_debt: '5000.0',
          status: 'active',
        },
        {
          loan_id: 457,
          contract_number: 'LOAN-2024-002',
          remaining_debt: '3000.0',
          status: 'active',
        },
      ],
    }

    it('should fetch incoming call information', async () => {
      const mockResponse = { data: mockIncomingCallData }
      vi.mocked(axios.get).mockResolvedValue(mockResponse)

      const result = await callService.getIncomingCallInfo(callId)

      expect(axios.get).toHaveBeenCalledWith(`${API_BASE_URL}/api/v1/calls/${callId}/incoming-info`)
      expect(result).toEqual(mockIncomingCallData)
      expect(result.call_id).toBe(callId)
      expect(result.customer_phone).toBe('+380501234567')
      expect(result.loan_count).toBe(2)
    })

    it('should fetch call with no loans', async () => {
      const noLoansData: IncomingCallData = {
        ...mockIncomingCallData,
        loan_count: 0,
        total_debt: '0',
        loans: [],
        client_name: undefined,
      }

      const mockResponse = { data: noLoansData }
      vi.mocked(axios.get).mockResolvedValue(mockResponse)

      const result = await callService.getIncomingCallInfo(callId)

      expect(result.loan_count).toBe(0)
      expect(result.total_debt).toBe('0')
      expect(result.loans).toEqual([])
    })

    it('should handle 404 when call not found', async () => {
      const mockError = {
        response: {
          status: 404,
          data: { detail: 'Call not found' },
        },
      }

      vi.mocked(axios.get).mockRejectedValue(mockError)

      await expect(callService.getIncomingCallInfo(callId)).rejects.toEqual(mockError)
    })

    it('should handle 400 when call is not inbound', async () => {
      const mockError = {
        response: {
          status: 400,
          data: { detail: 'Call is not an inbound call' },
        },
      }

      vi.mocked(axios.get).mockRejectedValue(mockError)

      await expect(callService.getIncomingCallInfo(callId)).rejects.toEqual(mockError)
    })

    it('should handle service unavailable', async () => {
      const mockError = {
        response: {
          status: 503,
          data: { detail: 'Loan lookup service not available' },
        },
      }

      vi.mocked(axios.get).mockRejectedValue(mockError)

      await expect(callService.getIncomingCallInfo(callId)).rejects.toEqual(mockError)
    })

    it('should handle network errors', async () => {
      const mockError = new Error('Network Error')

      vi.mocked(axios.get).mockRejectedValue(mockError)

      await expect(callService.getIncomingCallInfo(callId)).rejects.toThrow('Network Error')
    })

    it('should return client_name when provided', async () => {
      const mockResponse = { data: mockIncomingCallData }
      vi.mocked(axios.get).mockResolvedValue(mockResponse)

      const result = await callService.getIncomingCallInfo(callId)

      expect(result.client_name).toBe('Коваленко Іван Петрович')
    })

    it('should handle undefined client_name', async () => {
      const dataWithoutClient: IncomingCallData = {
        ...mockIncomingCallData,
        client_name: undefined,
      }

      const mockResponse = { data: dataWithoutClient }
      vi.mocked(axios.get).mockResolvedValue(mockResponse)

      const result = await callService.getIncomingCallInfo(callId)

      expect(result.client_name).toBeUndefined()
    })
  })
})
