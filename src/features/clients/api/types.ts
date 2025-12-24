/**
 * TypeScript types for Client API
 * Based on TIN-based brand isolation architecture
 */

export interface Client {
  id: number
  project_id: number
  tax_id: string // Ukrainian TIN - MANDATORY
  phone_primary: string
  phone_secondary?: string | null
  first_name: string
  last_name: string
  middle_name?: string | null
  date_of_birth?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  region?: string | null
  postal_code?: string | null
  country?: string

  // Priority scoring (moved from client_projects)
  priority_score: number
  status: string

  // Manual priority override
  manual_priority?: string | null
  manual_priority_reason?: string | null

  // Contact tracking
  last_contact_date?: string | null
  last_contact_type?: string | null
  contact_count: number

  // Metadata
  source: string
  first_import_batch_id?: string | null
  legacy_id?: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean

  // Debt summary
  debt_count: number
}

export interface ClientDetail extends Client {
  total_debt: number
}

export interface CreateClientRequest {
  phone_primary: string
  tax_id: string // MANDATORY
  first_name: string
  last_name: string
  middle_name?: string
  date_of_birth?: string
  phone_secondary?: string
  email?: string
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
}

export interface UpdateClientRequest {
  phone_primary?: string
  first_name?: string
  last_name?: string
  middle_name?: string
  date_of_birth?: string
  phone_secondary?: string
  email?: string
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  // Note: tax_id CANNOT be changed after creation
}

export interface GetClientsParams {
  project_id?: number
  skip?: number
  limit?: number
  sort_by_priority?: boolean
}

export interface ManualPriorityRequest {
  priority: 'high' | 'medium' | 'low' | 'excluded'
  reason: string
}

export interface SearchByTinParams {
  tin: string
  project_id?: number
}
