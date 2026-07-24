import api from '@/lib/api'

const REGISTRY_URL = '/api/v1/legal/registry'

/**
 * Correspondence registries (KAN — вхідний/вихідний реєстр). Backend contract:
 *   GET /api/v1/legal/registry/incoming  → { items, total }
 *   GET /api/v1/legal/registry/outgoing  → { items, total }
 *   GET /api/v1/legal/registry/{incoming|outgoing}/export → CSV blob (BOM added server-side)
 */

/** Letter category on a registry row. `color_id` is a letter-type palette key (e.g. red/teal). */
export interface RegistryLetterType {
  id: string
  name: string
  color_id: string
}

export interface RegistryClientRef {
  id: number
  name: string
}

export interface RegistryLawyerRef {
  id: number
  name: string
}

export interface IncomingRegistryItem {
  id: number | string
  /** Human registry number, e.g. "7". */
  number: string
  received_date: string
  sender_email: string | null
  summary: string | null
  letter_type: RegistryLetterType | null
  client: RegistryClientRef | null
  /** Row provenance — inbox letter vs. an uploaded incoming file. */
  source: 'letter' | 'file'
}

export interface OutgoingRegistryItem {
  id: number | string
  /** Outgoing number, e.g. "2307/01". */
  number: string
  request_received_at: string | null
  sender_email: string | null
  recipient_email: string | null
  letter_type: RegistryLetterType | null
  client_name: string | null
  institution_name: string | null
  issued_date: string
  lawyer: RegistryLawyerRef | null
}

export interface IncomingRegistryResponse {
  items: IncomingRegistryItem[]
  total: number
}

export interface OutgoingRegistryResponse {
  items: OutgoingRegistryItem[]
  total: number
}

export interface IncomingRegistryFilters {
  page?: number
  limit?: number
  date_from?: string
  date_to?: string
  letter_type_id?: string
  search?: string
}

export interface OutgoingRegistryFilters extends IncomingRegistryFilters {
  lawyer_id?: number
}

function buildIncomingParams(filters: IncomingRegistryFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.letter_type_id) params.set('letter_type_id', filters.letter_type_id)
  if (filters.search && filters.search.trim()) params.set('search', filters.search.trim())
  return params
}

function buildOutgoingParams(filters: OutgoingRegistryFilters): URLSearchParams {
  const params = buildIncomingParams(filters)
  if (filters.lawyer_id != null) params.set('lawyer_id', String(filters.lawyer_id))
  return params
}

export const legalRegistryApi = {
  listIncoming(filters: IncomingRegistryFilters = {}) {
    return api
      .get<IncomingRegistryResponse>(`${REGISTRY_URL}/incoming`, {
        params: buildIncomingParams(filters),
      })
      .then((response) => response.data)
  },

  listOutgoing(filters: OutgoingRegistryFilters = {}) {
    return api
      .get<OutgoingRegistryResponse>(`${REGISTRY_URL}/outgoing`, {
        params: buildOutgoingParams(filters),
      })
      .then((response) => response.data)
  },

  exportIncoming(filters: IncomingRegistryFilters = {}): Promise<Blob> {
    return api
      .get<Blob>(`${REGISTRY_URL}/incoming/export`, {
        params: buildIncomingParams(filters),
        responseType: 'blob',
        timeout: 120_000,
      })
      .then((response) => response.data)
  },

  exportOutgoing(filters: OutgoingRegistryFilters = {}): Promise<Blob> {
    return api
      .get<Blob>(`${REGISTRY_URL}/outgoing/export`, {
        params: buildOutgoingParams(filters),
        responseType: 'blob',
        timeout: 120_000,
      })
      .then((response) => response.data)
  },
}
