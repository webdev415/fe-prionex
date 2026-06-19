/**
 * Global IP whitelist API client.
 *
 * Backend endpoints (services/auth/app/routers/ip_whitelist.py):
 *   GET    /api/v1/admin/ip-whitelist
 *   POST   /api/v1/admin/ip-whitelist
 *   PUT    /api/v1/admin/ip-whitelist/{id}
 *   DELETE /api/v1/admin/ip-whitelist/{id}
 */

import api from '@/lib/api'
import type {
  IpWhitelistCreateInput,
  IpWhitelistEntry,
  IpWhitelistListResponse,
  IpWhitelistUpdateInput,
} from './types'

export async function listIpWhitelist(): Promise<IpWhitelistListResponse> {
  const response = await api.get<IpWhitelistListResponse>('/api/v1/admin/ip-whitelist')
  return response.data
}

export async function createIpWhitelistEntry(
  input: IpWhitelistCreateInput
): Promise<IpWhitelistEntry> {
  const response = await api.post<IpWhitelistEntry>('/api/v1/admin/ip-whitelist', input)
  return response.data
}

export async function updateIpWhitelistEntry(
  entryId: number,
  input: IpWhitelistUpdateInput
): Promise<IpWhitelistEntry> {
  const response = await api.put<IpWhitelistEntry>(`/api/v1/admin/ip-whitelist/${entryId}`, input)
  return response.data
}

export async function deleteIpWhitelistEntry(entryId: number): Promise<void> {
  await api.delete(`/api/v1/admin/ip-whitelist/${entryId}`)
}
