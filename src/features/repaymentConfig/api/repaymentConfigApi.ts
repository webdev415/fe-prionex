import { api } from '@/lib/api'

export type Algorithm = 'legacy_proportional' | 'strict_order'
export type RepaymentComponent = 'principal' | 'interest' | 'commission' | 'penalties' | 'fines'

export const REPAYMENT_COMPONENTS: RepaymentComponent[] = [
  'principal',
  'interest',
  'commission',
  'penalties',
  'fines',
]

export interface RepaymentRulesConfig {
  algorithm: Algorithm
  repayment_order: RepaymentComponent[]
  writeoff_enabled: Record<RepaymentComponent, boolean>
  version: number
  updated_at: string
  updated_by_username: string
}

export interface UpdateRepaymentRulesRequest {
  algorithm: Algorithm
  repayment_order: RepaymentComponent[]
  writeoff_enabled: Record<RepaymentComponent, boolean>
  version: number
}

export interface RepaymentConfigAuditEntry {
  id: number
  config_version: number
  algorithm: Algorithm
  repayment_order: RepaymentComponent[]
  writeoff_enabled: Record<RepaymentComponent, boolean>
  diff: Record<string, { old: unknown; new: unknown }>
  changed_by: number
  changed_by_username: string
  session_id: string | null
  created_at: string
}

export interface RepaymentConfigHistoryResponse {
  items: RepaymentConfigAuditEntry[]
  total: number
}

const BASE_URL = '/api/v1/config/repayment-rules'

export async function getRepaymentRules(): Promise<RepaymentRulesConfig> {
  const response = await api.get<RepaymentRulesConfig>(BASE_URL)
  return response.data
}

export async function updateRepaymentRules(
  request: UpdateRepaymentRulesRequest
): Promise<RepaymentRulesConfig> {
  const response = await api.put<RepaymentRulesConfig>(BASE_URL, request)
  return response.data
}

export async function getRepaymentRulesHistory(params?: {
  page?: number
  page_size?: number
}): Promise<RepaymentConfigHistoryResponse> {
  const response = await api.get<RepaymentConfigHistoryResponse>(`${BASE_URL}/history`, { params })
  return response.data
}
