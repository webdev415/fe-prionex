/**
 * SMS Service API Types
 * Types matching the backend SMS service schemas
 */

/**
 * Send SMS Request
 */
export interface SendSMSRequest {
  client_id?: number
  to_number?: string
  message_text?: string // SERVICE-006 format alias for custom_message
  template_id?: number
  variables?: Record<string, string>
  custom_message?: string
  override_recipient_limit?: boolean
}

/**
 * Send SMS Response
 */
export interface SendSMSResponse {
  message_id: string
  status: string
  client_id?: number
  to_number: string
  message_length: number
  sms_segments: number
  cost: number
  sent_at?: string
  template_id?: number
  rendered_message?: string
}

/**
 * Bulk Send SMS Request
 */
export interface BulkSendSMSRequest {
  client_ids: number[]
  template_id: number
  variables_per_client?: Record<string, Record<string, string>>
  override_recipient_limit?: boolean
}

/**
 * Bulk Send SMS Response
 */
export interface BulkSendSMSResponse {
  message: string
  total_recipients: number
  estimated_cost: number
  estimated_duration: string
  bulk_id: string
}

/**
 * SMS Template Variable
 */
export interface TemplateVariable {
  name: string
  required: boolean
}

/**
 * SMS Template (Create)
 */
export interface TemplateCreate {
  name: string
  description?: string
  category?: string
  message_text: string
  available_variables?: TemplateVariable[]
  max_length?: number
  project_id?: number
}

/**
 * SMS Template (Update)
 */
export interface TemplateUpdate {
  name?: string
  description?: string
  category?: string
  message_text?: string
  available_variables?: TemplateVariable[]
  max_length?: number
  is_active?: boolean
}

/**
 * SMS Template Response
 */
export interface TemplateResponse {
  id: number
  name: string
  description?: string
  category?: string
  message_text: string
  available_variables?: Record<string, unknown>[]
  max_length: number
  is_unicode: boolean
  project_id?: number
  is_active: boolean
  times_used: number
  last_used_at?: string
  created_at: string
  updated_at: string
}

/**
 * SMS Templates List Response
 */
export interface TemplatesListResponse {
  total: number
  templates: TemplateResponse[]
}

/**
 * SMS History Item
 */
export interface SMSHistoryItem {
  message_id: string
  operator_name?: string
  message_text: string
  status: string
  sent_at?: string
  delivered_at?: string
  failed_at?: string
  script?: string
  sms_segments: number
  cost?: number
  template_name?: string
}

/**
 * SMS History Response
 */
export interface SMSHistoryResponse {
  client_id: number
  client_name?: string
  total: number
  page: number
  limit: number
  items: SMSHistoryItem[]
}

/**
 * SMS History Query Parameters
 */
export interface SMSHistoryParams {
  status?: string
  from_date?: string // YYYY-MM-DD
  to_date?: string // YYYY-MM-DD
  page?: number
  limit?: number
}

/**
 * SMS Statistics Response (placeholder - add full type if needed)
 */
export interface SMSStatisticsResponse {
  // Add fields as needed
  [key: string]: unknown
}

/**
 * SMS Config Response
 */
export interface SMSConfigResponse {
  project_id?: number
  max_sms_per_operator_per_hour: number
  max_sms_per_recipient_per_day: number
  allow_supervisor_override: boolean
  base_cost_uah: number
}

/**
 * SMS Config Update
 */
export interface SMSConfigUpdate {
  max_sms_per_operator_per_hour?: number
  max_sms_per_recipient_per_day?: number
  allow_supervisor_override?: boolean
  base_cost_uah?: number
}
