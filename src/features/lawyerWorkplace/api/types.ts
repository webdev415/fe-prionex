export type LegalProcessingStatus =
  | 'new'
  | 'in_progress'
  | 'auto_processed'
  | 'done'
  | 'on_board'
  | 'sent_to_kanban'

export type LegalMessageDirection = 'incoming' | 'outgoing'

export type EdoType = 'none' | 'outgoing' | 'nbu'

export type LawyerPriorityRole = 'primary' | 'backup' | 'secondary' | 'off'

export type LawyerStatus = 'online' | 'away'

export interface LegalInboxItem {
  id: string
  thread_id: string
  mailbox_id: string | null
  mailbox_email?: string | null
  subject: string | null
  from_address: string
  to_addresses?: string[]
  processing_status: string
  direction: string
  received_at: string | null
  is_quarantined: boolean
  needs_manual_review: boolean
  suggested_letter_type_id: string | null
  suggested_client_id: number | null
  suggested_client_source?: string | null
  suggested_client_name?: string | null
  suggested_client_project_id?: number | null
  suggested_lawyer_user_id: number | null
  suggested_contract_number?: string | null
  auto_process_eligible: boolean
}

export interface LegalInboxResponse {
  items: LegalInboxItem[]
  total: number
  page: number
  page_size: number
  connected_mailboxes: number
  unprocessed_count: number
  count_all: number
  count_new: number
  count_in_progress: number
  count_done: number
}

export interface LegalMailbox {
  id: string
  email: string
  display_name: string
  status: string
  is_default_outgoing: boolean
}

export interface LegalMailboxListResponse {
  items: LegalMailbox[]
}

export interface LegalInboxParams {
  page?: number
  page_size?: number
  processing_status?: string
  direction?: string
  mailbox_id?: string
  include_quarantined?: boolean
  quarantine_only?: boolean
  q?: string
}

export interface LegalAttachmentItem {
  id: string
  filename: string
  content_type: string | null
  size_bytes: number | null
  is_quarantined: boolean
}

export interface LegalMessageDetail {
  id: string
  thread_id: string
  mailbox_id: string | null
  internet_message_id: string
  subject: string | null
  from_address: string
  to_addresses: string[]
  cc_addresses: string[]
  body_text: string | null
  body_html: string | null
  processing_status: string
  direction: string
  received_at: string | null
  sent_at: string | null
  is_quarantined: boolean
  quarantine_reason: string | null
  needs_manual_review: boolean
  suggested_letter_type_id: string | null
  suggested_client_id: number | null
  suggested_client_source?: string | null
  suggested_client_name?: string | null
  suggested_client_project_id?: number | null
  suggested_lawyer_user_id: number | null
  suggested_due_date?: string | null
  suggested_contract_number?: string | null
  confirmed_contract_number?: string | null
  confirmed_letter_type_id?: string | null
  auto_process_eligible: boolean
  legal_task_id?: number | null
  source_mailbox_disabled?: boolean
  updated_at?: string | null
  attachments: LegalAttachmentItem[]
}

export interface LegalThreadMessageItem {
  id: string
  direction: string
  from_address: string
  to_addresses?: string[]
  subject: string | null
  body_text: string | null
  body_html: string | null
  received_at: string | null
  sent_at: string | null
  processing_status: string
  is_quarantined: boolean
  attachments?: LegalAttachmentItem[]
}

export interface LegalThreadDetail {
  id: string
  subject: string | null
  root_message_id: string | null
  messages: LegalThreadMessageItem[]
}

export interface LegalLetterConfirmRequest {
  letter_type_id: string
  client_id: number
  due_date: string
  assigned_to_user_id: number
  contract_number?: string | null
}

export interface LegalLetterConfirmResponse {
  message_id: string
  legal_task_id: number
  processing_status: string
  confirmed_letter_type_id: string
  confirmed_client_id: number
  confirmed_lawyer_user_id: number
  confirmed_due_date: string
  confirmed_contract_number?: string | null
}

export interface LegalMessageSuggestionsPatchRequest {
  letter_type_id: string
  client_id?: number | null
  refresh_lawyer?: boolean
  suggested_lawyer_user_id?: number | null
  due_date?: string | null
}

export interface LegalMessageSuggestionsPatchResponse {
  suggested_letter_type_id: string
  suggested_lawyer_user_id: number | null
  suggested_due_date?: string | null
  suggested_contract_number?: string | null
  sla_days: number
  auto_process_eligible: boolean
  needs_manual_review: boolean
}

export interface LegalContractPatchRequest {
  contract_number?: string | null
}

export interface LegalContractPatchResponse {
  suggested_contract_number: string | null
}

export interface LegalLawyerSuggestion {
  lawyer_user_id: number | null
  lawyer_id: string | null
  source: string | null
}

export interface LegalThreadReplyRequest {
  mailbox_id: string
  in_reply_to_message_id: string
  to_addresses: string[]
  cc_addresses?: string[]
  subject?: string | null
  body_text?: string | null
  body_html?: string | null
  edo_type?: EdoType
  client_id?: number | null
  assigned_to_user_id?: number | null
  contract_number?: string | null
  attachment_ids?: string[]
  draft_message_id?: string | null
}

export interface LegalThreadReplyResponse {
  message_id: string
  thread_id: string
  internet_message_id: string
  legal_document_id: string | null
  legal_document_number: string | null
}

export interface LegalOutgoingLetterRequest {
  mailbox_id: string
  to_addresses: string[]
  cc_addresses?: string[]
  subject: string
  body_text?: string | null
  body_html?: string | null
  edo_type?: EdoType
  client_id?: number | null
  assigned_to_user_id?: number | null
  contract_number?: string | null
  /** Recipient institution name (required when the recipient is an institution). */
  institution_name?: string | null
  attachment_ids?: string[]
  staging_session_id?: string | null
}

export interface LegalReplyDraft {
  exists: boolean
  message_id: string
  mailbox_id: string | null
  body_text: string
  edo_type: EdoType
  updated_at: string
}

export interface LegalReplyDraftUpsert {
  body_text: string
  mailbox_id?: string | null
  edo_type?: EdoType
}

export interface LegalStagedAttachment {
  id: string
  filename: string
  content_type: string | null
  size_bytes: number | null
}

export interface LegalStagedAttachmentListResponse {
  items: LegalStagedAttachment[]
  total: number
}

export interface LegalOutgoingLetterResponse {
  message_id: string
  thread_id: string
  internet_message_id: string
  legal_document_id: string | null
  legal_document_number: string | null
}

export interface LegalKanbanTaskItem {
  task_id: number
  message_id: string | null
  letter_type_id: string | null
  title: string
  client_id: number | null
  client_name: string | null
  priority: string
  status: string
  due_date: string | null
  is_overdue: boolean
  assigned_to_user_id: number | null
  assigned_to_username: string | null
  completed_at: string | null
  updated_at: string | null
  /**
   * Number of letters grouped into this task (same client + lawyer + day).
   * Absent/1 means a single-letter task. Drives the "N листів" card badge.
   */
  letter_count?: number
}

export interface LegalKanbanResponse {
  items: LegalKanbanTaskItem[]
  total: number
}

/**
 * One letter of a grouped legal task. A trimmed inbox row plus message bodies
 * and attachments, so the drawer can render the whole group as a single thread
 * without extra per-letter message/thread requests.
 */
export interface LegalTaskLetter {
  id: string
  thread_id: string
  mailbox_id: string | null
  mailbox_email: string | null
  subject: string | null
  from_address: string
  to_addresses: string[]
  direction: string
  processing_status: string
  received_at: string | null
  sent_at: string | null
  is_quarantined: boolean
  needs_manual_review: boolean
  source_mailbox_disabled: boolean
  letter_type_id: string | null
  client_id: number | null
  client_name: string | null
  body_text: string | null
  body_html: string | null
  attachments: LegalAttachmentItem[]
}

/** Letters grouped into one legal task, ordered chronologically (received_at ASC). */
export interface LegalTaskLettersResponse {
  legal_task_id: number
  items: LegalTaskLetter[]
  total: number
}

export interface LegalKanbanTaskCreateRequest {
  letter_type_id: string
  client_id: number
  due_date: string
  assigned_to_user_id: number
  priority?: string
}

export interface LegalKanbanTaskCreateResponse {
  task_id: number
  message_id: string | null
}

export interface LegalTrainingExample {
  id: string
  letter_type_id: string
  title: string
  body: string
  source: string | null
  is_placeholder: boolean
}

export interface LegalLetterTypePriority {
  lawyer_id: string
  stars: number
  role: LawyerPriorityRole
}

export interface LegalLetterType {
  id: string
  slug: string
  name: string
  color_id: string
  sla_days: number
  /** How SLA days are counted; omitted by older backends → treat as calendar. */
  sla_day_type?: 'working' | 'calendar'
  description: string | null
  keyword_hints: string[]
  is_active: boolean
  letter_count: number
  examples: LegalTrainingExample[]
  priorities: LegalLetterTypePriority[]
}

export interface LegalLetterTypeListResponse {
  items: LegalLetterType[]
  total: number
}

export interface LegalLetterTypeCreate {
  id: string
  name: string
  color_id: string
  sla_days: number
  sla_day_type?: 'working' | 'calendar'
  description?: string | null
  keyword_hints?: string[]
  slug?: string | null
}

export interface LegalLetterTypeUpdate {
  name?: string
  color_id?: string
  sla_days?: number
  sla_day_type?: 'working' | 'calendar'
  description?: string | null
  keyword_hints?: string[]
  is_active?: boolean
}

export interface LegalTrainingExampleCreate {
  title: string
  body: string
  source?: string | null
  is_placeholder?: boolean
}

export interface LegalTrainingExampleUpdate {
  title?: string
  body?: string
  source?: string | null
  is_placeholder?: boolean
}

export interface LegalLetterTypePrioritiesUpdate {
  priorities: LegalLetterTypePriority[]
}

export interface LegalLawyer {
  id: string
  user_id: number
  display_name: string
  initials: string
  role_title: string | null
  letter_type_ids: string[]
  current_active: number
  max_in_flight: number
  status: LawyerStatus
  is_active: boolean
}

export interface LegalLawyerListResponse {
  items: LegalLawyer[]
  total: number
}

export interface LegalLawyerCreate {
  id: string
  user_id: number
  display_name: string
  initials: string
  role_title?: string | null
  max_in_flight?: number
  status?: LawyerStatus
  letter_type_ids?: string[]
}

export interface LegalLawyerUpdate {
  user_id?: number
  display_name?: string
  initials?: string
  role_title?: string | null
  max_in_flight?: number
  status?: LawyerStatus
  letter_type_ids?: string[]
  is_active?: boolean
}

export type LegalDocumentTypeFilter =
  | 'all'
  | 'incoming'
  | 'outgoing'
  | 'nbu_response'
  | 'uploaded'
  | 'generated'

export interface LegalDocumentListItem {
  id: string
  number: string
  title: string
  document_type: string
  action: string
  client_id: number | null
  contract_number: string | null
  assigned_to_user_id: number | null
  created_by_user_id: number
  related_letter_number: string | null
  source_message_id: string | null
  filename: string | null
  created_at: string
}

export interface LegalDocumentListResponse {
  items: LegalDocumentListItem[]
  total: number
  page: number
  page_size: number
}

export interface LegalDocumentStatsResponse {
  incoming_count: number
  incoming_year_total: number
  outgoing_count: number
  outgoing_year_total: number
  nbu_count: number
  nbu_year_total: number
  generated_percent: number
  filter_counts: Record<string, number>
}

export interface LegalDocumentListParams {
  page?: number
  page_size?: number
  type_filter?: LegalDocumentTypeFilter
  search?: string
  assigned_to_user_id?: number
}

export interface LegalGenerateDocumentRequest {
  document_type: 'outgoing' | 'nbu_response'
  title: string
  client_id: number
  assigned_to_user_id: number
  contract_number?: string | null
  related_letter_number?: string | null
}

export type LegalDocumentResponse = LegalDocumentListItem

export type LegalMailboxStatus = 'connected' | 'error' | 'disabled'
export type LegalSyncInterval = '15m' | '30m' | '1h' | '4h' | 'daily'
export type LegalRoutingMatchType = 'sender_domain' | 'subject_keyword' | 'default'

export interface LegalMailboxRoutingRule {
  id: string
  match_type: LegalRoutingMatchType
  value: string
  letter_type_id: string
  /** Whether the rule participates in identification. Older backends omit it → treat as active. */
  is_active?: boolean
  /** Tie-break order within the same match type. Older backends omit it → treat as 0. */
  priority?: number
}

export interface LegalSettingsMailbox {
  id: string
  email: string
  display_name: string
  status: LegalMailboxStatus
  provider: LegalMailboxProviderLegacy
  letter_count: number
  default_letter_type_id: string | null
  is_default_outgoing: boolean
  has_credentials: boolean
  routing_rules: LegalMailboxRoutingRule[]
}

export interface LegalSettingsMailboxListResponse {
  items: LegalSettingsMailbox[]
  total: number
}

export interface LegalMailboxRoutingRuleInput {
  id?: string
  match_type: LegalRoutingMatchType
  value: string
  letter_type_id: string
  is_active?: boolean
  priority?: number
}

export type LegalMailboxProvider = 'ukrnet' | 'iua' | 'google_workspace' | 'microsoft365' | 'custom'

/** Legacy provider value still returned for existing mailboxes. */
export type LegalMailboxProviderLegacy = LegalMailboxProvider | 'gmail_oauth2'

export interface LegalMailboxCreate {
  email: string
  display_name: string
  provider: LegalMailboxProvider
  password?: string | null
  imap_host?: string | null
  imap_port?: number | null
  imap_use_ssl?: boolean | null
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_use_tls?: boolean | null
  default_letter_type_id?: string | null
  is_default_outgoing?: boolean
  routing_rules?: LegalMailboxRoutingRuleInput[]
}

export interface LegalMailboxConnectionTest {
  email: string
  provider: LegalMailboxProvider
  password: string
  imap_host?: string | null
  imap_port?: number | null
  imap_use_ssl?: boolean | null
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_use_tls?: boolean | null
}

export interface LegalMailboxConnectionTestResponse {
  ok: boolean
}

export interface LegalMailboxUpdate {
  email?: string
  display_name?: string
  status?: 'connected' | 'disabled'
  provider?: LegalMailboxProvider
  password?: string | null
  imap_host?: string | null
  imap_port?: number | null
  imap_use_ssl?: boolean | null
  smtp_host?: string | null
  smtp_port?: number | null
  smtp_use_tls?: boolean | null
  default_letter_type_id?: string | null
  is_default_outgoing?: boolean
  routing_rules?: LegalMailboxRoutingRuleInput[]
}

export interface LegalDepartmentSyncSettings {
  sync_interval: LegalSyncInterval
  last_synced_at: string | null
}

export interface LegalDepartmentSyncSettingsUpdate {
  sync_interval: LegalSyncInterval
}

export interface LegalPollMailboxResult {
  mailbox_id: string
  ingested: number
  skipped: number
  failed: number
  fetched: number
  status: string
  error: string | null
}

export interface LegalPollAllMailboxesResponse {
  results: LegalPollMailboxResult[]
}

export interface LegalReplyTemplate {
  id: string
  name: string
  subject: string | null
  body: string
  letter_type_ids: string[]
  is_active: boolean
}

export interface LegalReplyTemplateListResponse {
  items: LegalReplyTemplate[]
  total: number
}

export interface LegalReplyTemplateCreate {
  name: string
  subject?: string | null
  body: string
  letter_type_ids?: string[]
  is_active?: boolean
}

export interface LegalReplyTemplateUpdate {
  name?: string
  subject?: string | null
  body?: string
  letter_type_ids?: string[]
  is_active?: boolean
}

export interface LegalClientSearchItem {
  id: number
  first_name: string
  last_name: string
  project_id: number
}

export interface LegalClientSearchResponse {
  items: LegalClientSearchItem[]
}

export interface LegalClientContractItem {
  debt_id: number
  contract_number: string | null
  status: string | null
  remaining_debt_amount: string | null
  seller_name: string | null
  purchase_date: string | null
}

export interface LegalClientContractListResponse {
  items: LegalClientContractItem[]
}
