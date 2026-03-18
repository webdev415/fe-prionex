/**
 * Configuration API - System configuration endpoints
 * Uses main api client (goes through Kong on port 8000)
 */

import api from '@/lib/api'

export interface PriorityThresholds {
  critical: number // Score >= critical → "Critical"
  high: number // Score >= high → "High"
  medium: number // Score >= medium → "Medium"
  low: number // Score < low → "Low" (usually 0)
}

export interface TINFormat {
  country: string
  length: string
  pattern: string
  description: string
}

export interface SystemConfig {
  priority_thresholds: PriorityThresholds
  tin_format: TINFormat
  version: string
}

export interface ScoringWeights {
  debt_amount: number
  days_overdue: number
  contact_history: number
}

export interface ScoringConfigResponse {
  config_id: number | null
  project_id: number | null
  seller_id: number | null
  is_global: boolean
  weights: ScoringWeights
  priority_thresholds: PriorityThresholds
  enabled: boolean
  updated_at: string | null
  source: 'database' | 'fallback'
}

export interface ScoringConfigUpdateRequest {
  project_id?: number | null
  seller_id?: number | null
  weights?: ScoringWeights
  priority_thresholds?: PriorityThresholds
  immediate_effect?: boolean
  change_reason?: string
}

export interface UpdateConfigResponse {
  config_id: number
  message: string
  changes_applied: Record<string, unknown>
  recalculation_triggered: boolean
  affected_clients: number
  task_id: string | null
}

export interface PriorityDistribution {
  count: number
  percentage: number
}

export interface PreviewRequest {
  project_id?: number | null
  seller_id?: number | null
  new_priority_thresholds: PriorityThresholds
}

export interface PreviewResponse {
  project_id: number | null
  seller_id: number | null
  total_clients: number
  current_distribution: Record<string, PriorityDistribution>
  new_distribution: Record<string, PriorityDistribution>
  changes: Record<
    string,
    {
      change: number
      direction: 'increase' | 'decrease' | 'no_change'
    }
  >
}

export interface SellerConfig {
  config_id: number
  seller_id: number
  seller_name: string
  weights: ScoringWeights
  priority_thresholds: PriorityThresholds
  enabled: boolean
  updated_at: string
  clients_affected: number
}

export interface SellerConfigListResponse {
  total_count: number
  seller_configs: SellerConfig[]
}

export interface DeleteResponse {
  message: string
  deleted_config_id: number
}

export interface ConfigHistoryEntry {
  history_id: number
  config_id: number
  project_id: number | null
  seller_id: number | null
  changed_by_user_id: number
  changed_by_username: string | null
  change_type: 'create' | 'update' | 'delete'
  changed_at: string
  change_reason: string | null
  before_config: Record<string, unknown> | null
  after_config: Record<string, unknown> | null
  changes_summary: Record<string, unknown>
}

export interface ConfigHistoryListResponse {
  total_count: number
  page: number
  page_size: number
  history: ConfigHistoryEntry[]
}

const CONFIG_BASE_URL = '/api/v1/config'

/**
 * Get full system configuration
 */
export async function getSystemConfig(): Promise<SystemConfig> {
  const response = await api.get<SystemConfig>(CONFIG_BASE_URL)
  return response.data
}

/**
 * Get priority score thresholds
 *
 * Returns configuration for mapping priority_score to display priority levels:
 * - score >= critical → "Critical"
 * - score >= high → "High"
 * - score >= medium → "Medium"
 * - score < medium → "Low"
 */
export async function getPriorityThresholds(): Promise<PriorityThresholds> {
  const response = await api.get<PriorityThresholds>(`${CONFIG_BASE_URL}/priority-thresholds`)
  return response.data
}

/**
 * Map priority score to display priority using thresholds
 */
export function mapScoreToPriority(
  score: number,
  thresholds: PriorityThresholds
): 'Critical' | 'High' | 'Medium' | 'Low' {
  if (score >= thresholds.critical) return 'Critical'
  if (score >= thresholds.high) return 'High'
  if (score >= thresholds.medium) return 'Medium'
  return 'Low'
}

/**
 * Get scoring configuration (weights + thresholds)
 */
export async function getScoringConfig(
  projectId?: number | null,
  sellerId?: number | null
): Promise<ScoringConfigResponse> {
  const params = new URLSearchParams()
  if (projectId !== undefined && projectId !== null) {
    params.append('project_id', projectId.toString())
  }
  if (sellerId !== undefined && sellerId !== null) {
    params.append('seller_id', sellerId.toString())
  }

  const url = `${CONFIG_BASE_URL}/scoring${params.toString() ? `?${params.toString()}` : ''}`
  const response = await api.get<ScoringConfigResponse>(url)
  return response.data
}

/**
 * Update scoring configuration
 * Admin only - updates weights and/or thresholds
 */
export async function updateScoringConfig(
  config: ScoringConfigUpdateRequest
): Promise<UpdateConfigResponse> {
  const response = await api.put<UpdateConfigResponse>(`${CONFIG_BASE_URL}/scoring`, config)
  return response.data
}

/**
 * Preview impact of threshold changes
 * Shows how many clients would move between priority levels
 * Admin only
 */
export async function previewScoringConfig(preview: PreviewRequest): Promise<PreviewResponse> {
  const response = await api.post<PreviewResponse>(`${CONFIG_BASE_URL}/scoring/preview`, preview)
  return response.data
}

/**
 * Get list of seller-specific configurations
 * Admin only - shows all seller overrides for current project
 */
export async function getSellerConfigs(): Promise<SellerConfigListResponse> {
  const response = await api.get<SellerConfigListResponse>(`${CONFIG_BASE_URL}/scoring/sellers`)
  return response.data
}

/**
 * Create seller-specific configuration
 * Admin only - creates threshold override for specific seller
 */
export async function createSellerConfig(
  sellerId: number,
  config: ScoringConfigUpdateRequest
): Promise<ScoringConfigResponse> {
  const response = await api.post<ScoringConfigResponse>(
    `${CONFIG_BASE_URL}/scoring/sellers/${sellerId}`,
    config
  )
  return response.data
}

/**
 * Update seller-specific configuration
 * Admin only - updates existing seller threshold override
 */
export async function updateSellerConfig(
  sellerId: number,
  config: ScoringConfigUpdateRequest
): Promise<ScoringConfigResponse> {
  const response = await api.put<ScoringConfigResponse>(
    `${CONFIG_BASE_URL}/scoring/sellers/${sellerId}`,
    config
  )
  return response.data
}

/**
 * Delete seller-specific configuration
 * Admin only - removes seller override, falls back to project-level config
 */
export async function deleteSellerConfig(sellerId: number): Promise<DeleteResponse> {
  const response = await api.delete<DeleteResponse>(
    `${CONFIG_BASE_URL}/scoring/sellers/${sellerId}`
  )
  return response.data
}

/**
 * Preview impact of seller-specific threshold changes
 * Shows how many clients for this seller would move between priority levels
 * Admin only
 */
export async function previewSellerConfig(
  sellerId: number,
  preview: PreviewRequest
): Promise<PreviewResponse> {
  const response = await api.post<PreviewResponse>(
    `${CONFIG_BASE_URL}/scoring/sellers/${sellerId}/preview`,
    preview
  )
  return response.data
}

/**
 * Get configuration change history
 * Admin only - shows audit trail of config changes with filters
 */
export async function getConfigHistory(params?: {
  page?: number
  page_size?: number
  seller_id?: number
  changed_by?: number
  start_date?: string
  end_date?: string
}): Promise<ConfigHistoryListResponse> {
  const queryParams = new URLSearchParams()
  if (params?.page) queryParams.append('page', params.page.toString())
  if (params?.page_size) queryParams.append('page_size', params.page_size.toString())
  if (params?.seller_id) queryParams.append('seller_id', params.seller_id.toString())
  if (params?.changed_by) queryParams.append('changed_by', params.changed_by.toString())
  if (params?.start_date) queryParams.append('start_date', params.start_date)
  if (params?.end_date) queryParams.append('end_date', params.end_date)

  const url = `${CONFIG_BASE_URL}/scoring/history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  const response = await api.get<ConfigHistoryListResponse>(url)
  return response.data
}

/**
 * Export configuration history to CSV
 * Admin only - downloads audit trail as CSV file
 */
export async function exportConfigHistory(params?: {
  seller_id?: number
  changed_by?: number
  start_date?: string
  end_date?: string
}): Promise<Blob> {
  const queryParams = new URLSearchParams()
  if (params?.seller_id) queryParams.append('seller_id', params.seller_id.toString())
  if (params?.changed_by) queryParams.append('changed_by', params.changed_by.toString())
  if (params?.start_date) queryParams.append('start_date', params.start_date)
  if (params?.end_date) queryParams.append('end_date', params.end_date)

  const url = `${CONFIG_BASE_URL}/scoring/history/export${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  const response = await api.get(url, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Exported API object for easier importing
 * Consistent with other service APIs (usersApi, rolesApi, projectsApi, etc.)
 */
export const configApi = {
  getSystemConfig,
  getPriorityThresholds,
  mapScoreToPriority,
  getScoringConfig,
  updateScoringConfig,
  previewScoringConfig,
  getSellerConfigs,
  createSellerConfig,
  updateSellerConfig,
  deleteSellerConfig,
  previewSellerConfig,
  getConfigHistory,
  exportConfigHistory,
}
