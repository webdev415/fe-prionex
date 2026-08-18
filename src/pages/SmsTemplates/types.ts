/**
 * SMS Templates Types
 */

export interface SmsTemplate {
  id: number
  name: string
  messageText: string
  category: string
  variables: string[]
  usageCount: number
  isEnabled: boolean
}

export type SmsTemplateCategory = 'Payment Reminder' | 'Urgent Contact' | 'General'
