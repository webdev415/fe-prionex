/**
 * SMS Service API Client
 * All SMS-related API calls go through Kong on port 8000
 */

import api from '@/lib/api'
import type {
  SendSMSRequest,
  SendSMSResponse,
  BulkSendSMSRequest,
  BulkSendSMSResponse,
  TemplateCreate,
  TemplateUpdate,
  TemplateResponse,
  TemplatesListResponse,
  TemplatesTrashListResponse,
  SMSHistoryResponse,
  SMSHistoryParams,
  SMSConfigResponse,
  SMSConfigUpdate,
} from './types'

const BASE_URL = '/api/v1/sms'

/**
 * Send SMS to a single client
 */
export async function sendSMS(request: SendSMSRequest): Promise<SendSMSResponse> {
  const response = await api.post<SendSMSResponse>(`${BASE_URL}/send`, request)
  return response.data
}

/**
 * Send bulk SMS
 */
export async function sendBulkSMS(request: BulkSendSMSRequest): Promise<BulkSendSMSResponse> {
  const response = await api.post<BulkSendSMSResponse>(`${BASE_URL}/send-bulk`, request)
  return response.data
}

/**
 * Get SMS templates list
 */
export async function getTemplates(params?: {
  project_id?: number
  category?: string
}): Promise<TemplatesListResponse> {
  const response = await api.get<TemplatesListResponse>(`${BASE_URL}/templates`, { params })
  return response.data
}

/**
 * Get single template by ID
 */
export async function getTemplate(templateId: number): Promise<TemplateResponse> {
  const response = await api.get<TemplateResponse>(`${BASE_URL}/templates/${templateId}`)
  return response.data
}

/**
 * Create SMS template
 */
export async function createTemplate(template: TemplateCreate): Promise<TemplateResponse> {
  const response = await api.post<TemplateResponse>(`${BASE_URL}/templates`, template)
  return response.data
}

/**
 * Update SMS template
 */
export async function updateTemplate(
  templateId: number,
  template: TemplateUpdate
): Promise<TemplateResponse> {
  const response = await api.put<TemplateResponse>(`${BASE_URL}/templates/${templateId}`, template)
  return response.data
}

/**
 * Delete SMS template
 *
 * Soft delete: the row stays and the template moves to trash, recoverable via
 * restoreTemplate until the retention purge removes it.
 */
export async function deleteTemplate(templateId: number): Promise<void> {
  await api.delete(`${BASE_URL}/templates/${templateId}`)
}

/**
 * List soft-deleted templates (trash)
 */
export async function getDeletedTemplates(params?: {
  category?: string
  limit?: number
  offset?: number
}): Promise<TemplatesTrashListResponse> {
  const response = await api.get<TemplatesTrashListResponse>(`${BASE_URL}/templates/trash`, {
    params,
  })
  return response.data
}

/**
 * Restore a soft-deleted template back into the active list
 */
export async function restoreTemplate(templateId: number): Promise<TemplateResponse> {
  const response = await api.post<TemplateResponse>(`${BASE_URL}/templates/${templateId}/restore`)
  return response.data
}

/**
 * Get SMS history for a client
 */
export async function getClientSMSHistory(
  clientId: number,
  params?: SMSHistoryParams
): Promise<SMSHistoryResponse> {
  const response = await api.get<SMSHistoryResponse>(`${BASE_URL}/client/${clientId}`, { params })
  return response.data
}

/**
 * Get SMS configuration
 */
export async function getSMSConfig(projectId?: number): Promise<SMSConfigResponse> {
  const params = projectId ? { project_id: projectId } : undefined
  const response = await api.get<SMSConfigResponse>(`${BASE_URL}/config`, { params })
  return response.data
}

/**
 * Update SMS configuration
 */
export async function updateSMSConfig(config: SMSConfigUpdate): Promise<SMSConfigResponse> {
  const response = await api.put<SMSConfigResponse>(`${BASE_URL}/config`, config)
  return response.data
}
