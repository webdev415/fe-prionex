/**
 * Global IP whitelist — types mirror the backend
 * (services/auth/app/schemas/ip_whitelist.py).
 */

export interface IpWhitelistEntry {
  id: number
  ip_address: string
  label?: string | null
  created_at: string
  updated_at: string
  created_by?: number | null
  updated_by?: number | null
}

export interface IpWhitelistListResponse {
  entries: IpWhitelistEntry[]
}

export interface IpWhitelistCreateInput {
  ip_address: string
  label?: string
}

export interface IpWhitelistUpdateInput {
  ip_address?: string
  label?: string | null
}
