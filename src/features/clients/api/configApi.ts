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
 * Exported API object for easier importing
 * Consistent with other service APIs (usersApi, rolesApi, projectsApi, etc.)
 */
export const configApi = {
  getSystemConfig,
  getPriorityThresholds,
  mapScoreToPriority,
}
