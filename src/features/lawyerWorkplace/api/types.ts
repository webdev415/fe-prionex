export type LegalProcessingStatus =
  | 'new'
  | 'in_progress'
  | 'on_board'
  | 'sent_to_kanban'
  | 'auto_processed'

export type LegalMessageDirection = 'incoming' | 'outgoing'

export type EdoType = 'none' | 'outgoing' | 'nbu'

export type LawyerPriorityRole = 'primary' | 'backup' | 'secondary' | 'off'

export type LawyerStatus = 'online' | 'away'

export interface LegalInboxItem {
  id: string
  thread_id: string
  mailbox_id: string | null
  subject: string | null
  from_address: string
  processing_status: string
  direction: string
  received_at: string | null
  is_quarantined: boolean
  needs_manual_review: boolean
  suggested_letter_type_id: string | null
  suggested_client_id: number | null
  suggested_lawyer_user_id: number | null
  auto_process_eligible: boolean
}

export interface LegalInboxResponse {
  items: LegalInboxItem[]
  total: number
  page: number
  page_size: number
  connected_mailboxes: number
  unprocessed_count: number
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
  mailbox_id?: string
  include_quarantined?: boolean
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
  suggested_lawyer_user_id: number | null
  auto_process_eligible: boolean
  attachments: LegalAttachmentItem[]
}

export interface LegalThreadMessageItem {
  id: string
  direction: string
  from_address: string
  subject: string | null
  body_text: string | null
  body_html: string | null
  received_at: string | null
  sent_at: string | null
  processing_status: string
  is_quarantined: boolean
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
}

export interface LegalLetterConfirmResponse {
  message_id: string
  legal_task_id: number
  processing_status: string
  confirmed_letter_type_id: string
  confirmed_client_id: number
  confirmed_lawyer_user_id: number
  confirmed_due_date: string
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
}

export interface LegalKanbanResponse {
  items: LegalKanbanTaskItem[]
  total: number
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
  description?: string | null
  keyword_hints?: string[]
  slug?: string | null
}

export interface LegalLetterTypeUpdate {
  name?: string
  color_id?: string
  sla_days?: number
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
