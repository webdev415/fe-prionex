/**
 * SMS Templates Utilities
 * Helper functions for template data transformation
 */

import type { TemplateResponse } from '@/features/sms'
import type { SmsTemplate } from './types'

/**
 * Map API TemplateResponse to frontend SmsTemplate type
 */
export function mapTemplateResponseToSmsTemplate(apiTemplate: TemplateResponse): SmsTemplate {
  // Extract variable names from available_variables array
  const variables =
    apiTemplate.available_variables?.map((v) => {
      if (typeof v === 'string') return v
      if (typeof v === 'object' && v !== null && 'name' in v) {
        return String(v.name)
      }
      return String(v)
    }) || []

  return {
    id: apiTemplate.id,
    name: apiTemplate.name,
    messageText: apiTemplate.message_text,
    category: apiTemplate.category || 'General',
    variables,
    usageCount: apiTemplate.times_used,
    isEnabled: apiTemplate.is_active,
  }
}

/**
 * Map multiple API TemplateResponse to frontend SmsTemplate array
 */
export function mapTemplateResponseArray(apiTemplates: TemplateResponse[]): SmsTemplate[] {
  return apiTemplates.map(mapTemplateResponseToSmsTemplate)
}
