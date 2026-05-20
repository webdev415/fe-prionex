/**
 * Client Search API
 *
 * API functions for global client search functionality.
 * Implements the enhanced search endpoint from client-service.
 */

import { api } from '@/lib/api'

/**
 * Search type enum matching backend
 */
export type SearchType = 'phone' | 'name' | 'email' | 'contract_number' | 'tin' | 'all'

/**
 * Priority level from backend
 */
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low'

/**
 * Enhanced search result from backend
 */
export interface EnhancedSearchResult {
  id: number
  full_name: string
  phone_primary: string | null
  email_primary: string | null
  tax_id: string
  priority_score: number
  priority_level: PriorityLevel
  status: string
  total_debt: string
  debt_count: number
  primary_creditor: string | null
}

/**
 * Search response from backend
 */
export interface SearchResponse {
  items: EnhancedSearchResult[]
  total: number
  query: string
  search_type: string
}

export interface PhoneLinkedClient {
  id: number
  legacy_id?: string | null
  first_name: string
  last_name: string
  middle_name?: string | null
}

/**
 * Search params for the API call
 */
export interface SearchParams {
  q: string
  search_type?: SearchType
  limit?: number
}

/**
 * Search clients globally
 *
 * @param params - Search parameters
 * @returns Search results with client details and debt summary
 *
 * @example
 * ```ts
 * const results = await searchClients({ q: '050123', search_type: 'phone', limit: 10 })
 * ```
 */
export async function searchClients(params: SearchParams): Promise<SearchResponse> {
  const response = await api.get<SearchResponse>('/api/v1/clients/search', {
    params: {
      q: params.q,
      search_type: params.search_type || 'all',
      limit: params.limit || 10,
    },
  })
  return response.data
}

/**
 * Search clients by exact phone number match.
 *
 * Uses backend endpoint optimized for exact phone lookup in client contacts.
 */
export async function searchClientsByPhoneExact(phone: string): Promise<PhoneLinkedClient[]> {
  const response = await api.get<PhoneLinkedClient[]>(
    `/api/v1/clients/phone/${encodeURIComponent(phone)}`
  )
  return response.data
}

/**
 * Map backend priority level to frontend format
 */
export function mapPriorityLevel(level: PriorityLevel): 'Critical' | 'High' | 'Medium' | 'Low' {
  const mapping: Record<PriorityLevel, 'Critical' | 'High' | 'Medium' | 'Low'> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }
  return mapping[level]
}
