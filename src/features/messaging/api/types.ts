export type MessagingChannel = 'sms' | 'viber' | 'email'
export type MessagingSource = 'single' | 'bulk'

export const MESSAGING_CHANNELS: MessagingChannel[] = ['sms', 'viber', 'email']

/** Campaign lifecycle values from messaging-service dispatch (``dispatch.py``). */
export const MESSAGING_CAMPAIGN_STATUSES = [
  'queued',
  'sending',
  'completed',
  'partially_failed',
  'failed',
] as const
export type MessagingCampaignStatus = (typeof MESSAGING_CAMPAIGN_STATUSES)[number]
export const KNOWN_MESSAGING_SERVICES = [
  'turbosms',
  'omnicell',
  'vodafone_obm',
  'my2_viber',
  'intel_tele',
] as const
export type MessagingService = (typeof KNOWN_MESSAGING_SERVICES)[number]

export const SERVICE_CHANNEL_MATRIX: Record<MessagingService, MessagingChannel[]> = {
  turbosms: ['sms'],
  omnicell: ['sms'],
  vodafone_obm: ['sms'],
  my2_viber: ['viber'],
  intel_tele: ['email'],
}

export const getSupportedChannelsForService = (service: string): MessagingChannel[] =>
  SERVICE_CHANNEL_MATRIX[service as MessagingService] ?? []

export const serviceSupportsChannel = (service: string, channel: MessagingChannel): boolean =>
  getSupportedChannelsForService(service).includes(channel)

export const MESSAGING_SERVICE_LABELS: Record<MessagingService, string> = {
  turbosms: 'TurboSMS',
  omnicell: 'OmniCell',
  vodafone_obm: 'Vodafone OBM',
  my2_viber: 'My2 Viber',
  intel_tele: 'Intel-Tele.com',
}

export const getMessagingServiceLabel = (service: string): string =>
  MESSAGING_SERVICE_LABELS[service as MessagingService] ?? service

/** Services with a live API adapter (not placeholder). */
export const IMPLEMENTED_MESSAGING_SERVICES: MessagingService[] = [
  'turbosms',
  'omnicell',
  'vodafone_obm',
  'my2_viber',
  'intel_tele',
]

export const REQUIRED_CREDENTIAL_KEYS: Record<MessagingService, string[]> = {
  turbosms: ['api_key', 'sender'],
  omnicell: ['username', 'password', 'sender'],
  vodafone_obm: ['username', 'password', 'sender'],
  my2_viber: ['api_key', 'sender'],
  intel_tele: ['username', 'api_key', 'from_email'],
}

export const OPTIONAL_CREDENTIAL_KEYS: Record<MessagingService, string[]> = {
  intel_tele: ['from_name', 'reply_to_email', 'reply_to_name', 'domain_id'],
  turbosms: [],
  omnicell: [],
  vodafone_obm: ['sender_id'],
  my2_viber: [],
}

const CREDENTIAL_ALIASES: Record<string, string[]> = {
  api_key: ['api_key', 'token'],
  domain_id: ['domain_id', 'mailersend_domain_id'],
  sender: ['sender', 'sender_name'],
  from_email: ['from_email', 'sender_email'],
  reply_to_email: ['reply_to_email', 'reply_to'],
  username: ['username', 'login'],
  password: ['password', 'secret'],
}

export function isMessagingProviderImplemented(service: string): boolean {
  return IMPLEMENTED_MESSAGING_SERVICES.includes(service as MessagingService)
}

function credentialValue(creds: Record<string, unknown>, canonicalKey: string): string | null {
  const aliases = CREDENTIAL_ALIASES[canonicalKey] ?? [canonicalKey]
  for (const alias of aliases) {
    const raw = creds[alias]
    if (raw === null || raw === undefined) continue
    if (typeof raw === 'string') {
      if (raw.trim()) return raw.trim()
    } else {
      return String(raw)
    }
  }
  return null
}

export function missingMessagingCredentialKeys(
  service: string,
  creds: Record<string, unknown>
): string[] {
  const required = REQUIRED_CREDENTIAL_KEYS[service as MessagingService] ?? ['api_key']
  return required.filter((key) => !credentialValue(creds, key))
}

export function messagingCredentialsComplete(
  service: string,
  creds: Record<string, unknown>
): boolean {
  return missingMessagingCredentialKeys(service, creds).length === 0
}

export function storedCredentialsComplete(
  service: string,
  preview: Record<string, unknown>
): boolean {
  return messagingCredentialsComplete(service, preview)
}

/** True when Test may run (saved or form credentials are complete; provider has live API). */
export function canTestMessagingIntegration(
  service: string,
  options: {
    credentialsPreview: Record<string, unknown>
    formComplete: boolean
  }
): boolean {
  if (!isMessagingProviderImplemented(service)) {
    return false
  }
  return options.formComplete
}

/** Integration may be used for sends: live provider, channel enabled, test passed, credentials stored. */
export function isMessagingIntegrationUsable(
  integration: MessagingIntegration,
  channel: MessagingChannel
): boolean {
  if (!isMessagingProviderImplemented(integration.service)) {
    return false
  }
  if (!serviceSupportsChannel(integration.service, channel)) {
    return false
  }
  if (!integration.enabled_channels.includes(channel)) {
    return false
  }
  if (integration.status !== 'configured') {
    return false
  }
  if (integration.last_test_result?.ok !== true) {
    return false
  }
  return storedCredentialsComplete(integration.service, integration.credentials_preview ?? {})
}

export interface MessagingDraft {
  id: number
  project_id: number
  channel: MessagingChannel
  name: string
  body: string
  subject: string | null
  sender_name: string | null
  available_variables: string[] | null
  created_by: number | null
  created_at: string
  updated_at: string | null
}

export interface MessagingDraftCreate {
  name: string
  channel: MessagingChannel
  body: string
  subject?: string | null
  sender_name?: string | null
  available_variables?: string[] | null
}

export interface MessagingDraftUpdate {
  name?: string
  body?: string
  subject?: string | null
  sender_name?: string | null
  available_variables?: string[] | null
}

export interface MessagingDraftPreviewResponse {
  body: string
  subject: string | null
  missing_variables: string[]
}

export interface MessagingIntegration {
  id: number
  project_id: number
  service: string
  supported_channels: MessagingChannel[]
  enabled_channels: MessagingChannel[]
  status: string
  credentials_preview: Record<string, unknown>
  last_tested_at: string | null
  last_test_result: Record<string, unknown> | null
  created_at: string
  updated_at: string | null
}

export interface MessagingIntegrationCreate {
  service: string
  supported_channels: MessagingChannel[]
  enabled_channels: MessagingChannel[]
  credentials?: Record<string, unknown>
}

export interface MessagingIntegrationUpdate {
  supported_channels?: MessagingChannel[]
  enabled_channels?: MessagingChannel[]
  credentials?: Record<string, unknown> | null
}

export interface MessagingIntegrationTestResult {
  ok: boolean
  tested_at: string
  details: Record<string, unknown>
}

export interface MessagingIntegrationCredentialsReveal {
  service: string
  credentials: Record<string, unknown>
}

export interface MessagingCampaignSummary {
  id: number
  code: string
  project_id: number
  name: string
  source: MessagingSource
  channel: MessagingChannel
  service: string
  status: string
  total_recipients: number
  sent_count: number
  delivered_count: number
  failed_count: number
  skipped_count: number
  initiated_by: number
  launched_at: string
  completed_at: string | null
  total_cost: string | null
  cost_currency: string | null
  cost_status: string | null
}

export interface MessagingCampaignListResponse {
  items: MessagingCampaignSummary[]
  total: number
}

export interface MessagingCampaignDetail extends MessagingCampaignSummary {
  draft_id: number | null
  message_snapshot: Record<string, unknown>
  selection_payload: Record<string, unknown>
}

export interface MessagingCampaignRecipient {
  id: number
  campaign_id: number
  client_id: number
  client_name?: string | null
  destination: string | null
  rendered_body: string | null
  rendered_subject: string | null
  status: string
  external_message_id: string | null
  error_code: string | null
  error_message: string | null
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
}

export interface MessagingRecipientPreview {
  total: number
  eligible: number
  skipped: number
  skipped_by_reason: Record<string, number>
  sample: Array<Record<string, unknown>>
}

export interface MessagingSelectionPayloadIds {
  mode: 'ids'
  ids: number[]
}

export interface MessagingSelectionPayloadFilter {
  mode: 'filter'
  filters: Record<string, unknown>
  limit?: number
}

export type MessagingSelectionPayload =
  | MessagingSelectionPayloadIds
  | MessagingSelectionPayloadFilter
  | Record<string, unknown>

export interface MessagingCampaignCreate {
  name: string
  channel: MessagingChannel
  service: string
  draft_id?: number | null
  body?: string | null
  subject?: string | null
  sender_name?: string | null
  selection_payload: MessagingSelectionPayload
  source?: MessagingSource
}

export interface MessagingDestinationQuota {
  destination: string
  sent_today: number
  daily_limit: number
  allowed: boolean
}

export interface MessagingSingleSendRequest {
  client_id: number
  channel: MessagingChannel
  service: string
  draft_id?: number | null
  body?: string | null
  subject?: string | null
  sender_name?: string | null
  variables?: Record<string, unknown>
  destination_override?: string | null
  destination_owner?: string | null
  destination_contact_type_id?: number | null
  name?: string | null
}

export interface MessagingSingleSendResponse {
  campaign_id: number
  campaign_code: string
  recipient_id: number
  status: string
}

export interface MessagingClientHistoryItem {
  recipient_id: number
  campaign_id: number
  campaign_code: string
  campaign_name: string
  channel: MessagingChannel
  service: string
  source: MessagingSource
  initiated_by?: number
  initiatedBy?: number
  destination: string | null
  destination_owner?: string | null
  destination_contact_type_id?: number | null
  body: string | null
  subject: string | null
  status: string
  external_message_id: string | null
  error_message: string | null
  sent_at: string | null
  delivered_at: string | null
  failed_at: string | null
}
