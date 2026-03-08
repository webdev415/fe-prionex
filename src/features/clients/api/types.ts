/**
 * TypeScript types for Client API
 * Based on TIN-based brand isolation architecture
 */

export interface DebtDetail {
  id: number
  seller_id?: number
  seller_company: string
  contract_number: string
  original_debt_amount: string
  remaining_debt_amount: string
  debt_currency?: string
  purchase_date?: string | null
  debt_start_date?: string | null
  debt_close_date?: string | null
  days_past_due?: number | null
  status: string
  total_paid?: string | null
  last_payment_date?: string | null
  last_payment_amount?: string | null
  // 12 fields added for client detail page
  principal_amount?: string | null
  interest_amount?: string | null
  penalties_amount?: string | null
  fines_amount?: string | null
  fees_amount?: string | null
  interest_rate?: string | null
  penalty_rate?: string | null
  fine_rate?: string | null
  credit_issued_date?: string | null
  credit_term_days?: number | null
  credit_closed_date?: string | null
  portfolio_name?: string | null
  // Enriched fields from loans refactor
  principal_paid?: string | null
  principal_written_off?: string | null
  principal_debt?: string | null
  total_paid_amount?: string | null
  total_to_return?: string | null
}

export interface RestructuringAgreementSummary {
  id: number
  debt_id?: number | null
  contract_number?: string | null
  seller_company?: string | null
  purchase_date?: string | null
  restructuring_amount?: string | null
  first_payment_date?: string | null
  remaining_debt_amount?: string | null
  status_id?: number | null
  status_name?: string | null
}

export interface RestructuringPaymentEntry {
  date?: string | null
  amount?: string | null
}

export interface CreateRestructuringAgreementRequest {
  debt_id?: number | null
  connection_date?: string | null
  restructuring_amount: number
  num_payments: number
  payments: Array<{
    payment_date?: string | null
    payment_amount?: number | null
  }>
}

export interface RestructuringAgreementDetail {
  id: number
  contract_number?: string | null
  client_id?: number | null
  restructuring_amount?: string | null
  first_payment_date?: string | null
  first_payment_amount?: string | null
  num_payments?: number | null
  monthly_payment_amount?: string | null
  responsible_user_name?: string | null
  payments: RestructuringPaymentEntry[]
}

export interface Client {
  id: number
  project_id: number
  tax_id: string // Ukrainian TIN - MANDATORY
  phone_primary?: string | null
  first_name: string
  last_name: string
  middle_name?: string | null
  date_of_birth?: string | null
  email?: string | null
  address?: string | null
  postal_code?: string | null

  // Priority scoring (moved from client_projects)
  priority_score: number
  status: string

  // Manual priority override
  manual_priority?: string | null
  manual_priority_reason?: string | null

  // Contact tracking
  last_contact_date?: string | null
  last_contact_type?: string | null
  contact_count: number

  // Metadata
  first_import_batch_id?: string | null
  legacy_id?: string | null
  created_at: string
  updated_at: string
  is_deleted: boolean

  // Debt summary
  debt_count: number
  total_debt: string
  primary_creditor?: string | null

  // Assignment (Sprint 2 - Phase A)
  responsible_employee_id?: number | null
  responsible_searcher_id?: number | null
  assigned_at?: string | null
  assigned_by?: number | null

  // Tags (Sprint 2.5 - Phase 2.3)
  tags?: Array<{ id: number; name: string; color: string; description?: string | null }>
}

export interface ClientDetail extends Client {
  // Detailed debt list
  debts?: DebtDetail[]

  // Additional manual priority fields
  manual_priority_set_at?: string | null
  manual_priority_set_by?: number | null
}

export interface CreateClientRequest {
  tax_id: string // MANDATORY
  first_name: string
  last_name: string
  middle_name?: string
  date_of_birth?: string
  email?: string
  address?: string
  postal_code?: string
}

export interface UpdateClientRequest {
  tax_id?: string
  first_name?: string
  last_name?: string
  middle_name?: string
  date_of_birth?: string
  email?: string
  address?: string
  postal_code?: string
  marital_status?: string
  family_members_count?: number
  income_level?: string
}

export interface UpdateEmploymentRequest {
  company_name?: string
  position?: string
  employment_type?: string
  manager_full_name?: string
  work_phone?: string
  work_experience_months?: number
}

export interface UpdatePassportRequest {
  document_type?: string
  series?: string
  number?: string
  issued_by?: string
  issued_date?: string
  expires_date?: string
  gender?: string
}

export interface GetClientsParams {
  // Pagination
  project_id?: number
  skip?: number
  limit?: number

  // Sorting
  sort_by_priority?: boolean // Legacy parameter
  sort_by?: 'priority_score' | 'created_at' | 'first_name' | 'last_name' | 'id'
  sort_order?: 'asc' | 'desc'

  // Filter: Portfolio/Sellers
  seller_ids?: string // Comma-separated seller IDs (e.g., "1,5,12")

  // Filter: Date Range
  sale_date_from?: string // YYYY-MM-DD format
  sale_date_to?: string // YYYY-MM-DD format

  // Filter: Assignment
  responsible_employee_id?: number
  responsible_searcher_id?: number
  unassigned_only?: boolean

  // Filter: Debt Amounts (legacy - remaining debt)
  debt_min?: number
  debt_max?: number

  // Filter: Principal Amount
  principal_min?: number
  principal_max?: number

  // Filter: Total Debt Amount
  total_debt_min?: number
  total_debt_max?: number

  // Filter: Days Past Due
  dpd_min?: number
  dpd_max?: number

  // Filter: Status
  status?: string // Comma-separated statuses (e.g., "active,new")
}

export interface ManualPriorityRequest {
  priority: 'high' | 'medium' | 'low' | 'excluded'
  reason: string
}

export interface SearchByTinParams {
  tin: string
  project_id?: number
}

export interface PriorityStat {
  count: number
  total_debt: string
}

export interface PrioritySummary {
  critical: PriorityStat
  high: PriorityStat
  medium: PriorityStat
  low: PriorityStat
}

export interface PaginatedClientResponse {
  items: Client[]
  total: number
  page: number
  page_size: number
  total_pages: number
  priority_summary?: PrioritySummary
}

// Assignment request/response types
export interface AssignClientRequest {
  responsible_employee_id?: number
  responsible_searcher_id?: number
  assignment_reason?: string
}

export interface BulkAssignClientRequest {
  client_ids: number[]
  responsible_employee_id?: number
  responsible_searcher_id?: number
  assignment_reason?: string
}

export interface BulkAssignmentResponse {
  assigned_count: number
  failed_count: number
  failures: Array<{
    client_id: number
    reason: string
  }>
}

// --- Client Detail Response Types ---

export interface ClientProfileResponse {
  id: number
  full_name: string
  first_name: string
  last_name: string
  middle_name?: string | null
  email?: string | null
  tax_id: string
  phone_primary?: string | null
  date_of_birth?: string | null
  age?: number | null
  priority_score: number
  priority_level: string
  manual_priority?: string | null
  status: string
  marital_status?: string | null
  family_members_count?: number | null
  income_level?: string | null
  is_bankrupt: boolean
  is_deceased: boolean
  is_fraudster: boolean
  is_military: boolean
  has_nbu_complaint: boolean
  sale_notes?: string | null
  responsible_employee_id?: number | null
  responsible_employee_name?: string | null
  responsible_searcher_id?: number | null
  responsible_searcher_name?: string | null
  tags: Array<{ id: number; name: string; color?: string | null }>
  passport?: {
    document_type?: string | null
    series?: string | null
    number: string
    issued_by?: string | null
    issued_date?: string | null
    expires_date?: string | null
    gender?: string | null
  } | null
  employment?: {
    company_name?: string | null
    position?: string | null
    work_experience_months?: number | null
    manager_full_name?: string | null
    employment_type?: string | null
    work_phone?: string | null
  } | null
  recommenders: Array<{
    id: number
    contact_value: string
    contact_type_id?: number | null
    contact_type_name?: string | null
    is_phone?: boolean
    comment?: string | null
    created_at?: string | null
    added_by_user_name?: string | null
  }>
  addresses: Array<{
    id: number
    address_type: string
    full_address?: string | null
    country?: string | null
    region?: string | null
    city?: string | null
    district?: string | null
    street?: string | null
    building?: string | null
    house_number?: string | null
    apartment?: string | null
    postal_code?: string | null
    housing_type?: string | null
    is_primary?: boolean
  }>
  additional_phones: Array<{
    number: string
    type: string
    label?: string | null
    created_at?: string | null
    added_by_user_name?: string | null
  }>
  comments: Array<{
    id: number
    content: string
    note_type: string
    created_at: string
    created_by: number
    created_by_name?: string | null
  }>
}

export interface WriteoffResponse {
  id: number
  debt_id: number
  contract_number?: string | null
  seller_name?: string | null
  purchase_date?: string | null
  writeoff_date?: string | null
  amount?: string | null
  writeoff_type?: string | null
  submitted_by_name?: string | null
}

// --- Address CRUD Types ---

export interface CreateAddressRequest {
  address_type: string
  country?: string
  region?: string
  city?: string
  district?: string
  street?: string
  building?: string
  house_number?: string
  apartment?: string
  postal_code?: string
  housing_type?: string
  is_primary?: boolean
}

export interface UpdateAddressRequest {
  address_type?: string
  country?: string
  region?: string
  city?: string
  district?: string
  street?: string
  building?: string
  house_number?: string
  apartment?: string
  postal_code?: string
  housing_type?: string
  is_primary?: boolean
}

export interface AddressResponse {
  id: number
  client_id: number
  address_type: string
  full_address?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  street?: string | null
  building?: string | null
  apartment?: string | null
  postal_code?: string | null
  is_primary: boolean
  is_current: boolean
  created_at: string
  updated_at?: string | null
}

// --- Contact CRUD Types ---

export interface CreateContactRequest {
  contact_value: string
  contact_type_id?: number | null
  comment?: string
}

export interface UpdateContactRequest {
  contact_value?: string
  contact_type_id?: number | null
  comment?: string
}

export interface ContactResponse {
  id: number
  client_id: number
  contact_value: string
  contact_type_id?: number | null
  comment?: string | null
  added_date?: string | null
  added_by_user_id?: number | null
  created_at: string
  updated_at?: string | null
}

export interface ContactTypeOption {
  id: number
  code: string
  name: string
  is_phone: boolean
}

export interface WriteoffsResponse {
  writeoffs: WriteoffResponse[]
  total: number
}

export interface AssignmentHistoryEntry {
  id: number
  assignment_type: string
  assigned_by_name?: string | null
  old_employee_id?: number | null
  old_employee_name?: string | null
  new_employee_id?: number | null
  new_employee_name?: string | null
  old_searcher_id?: number | null
  old_searcher_name?: string | null
  new_searcher_id?: number | null
  new_searcher_name?: string | null
  assignment_reason?: string | null
  assigned_at: string
}

export interface AssignmentHistoryResponse {
  history: AssignmentHistoryEntry[]
  total: number
  current_employee?: { id: number; name: string } | null
  current_searcher?: { id: number; name: string } | null
}

// --- Payment Response Types ---

export interface PaymentResponse {
  id: number
  payment_number: string
  project_id: number
  client_id: number
  amount: string
  currency: string
  debt_before: string
  debt_after: string
  principal_paid: string
  interest_paid: string
  fees_paid: string
  penalty_paid: string
  fines_paid: string
  payment_method: string
  payment_method_details?: string | null
  status: string
  payment_date: string
  recorded_at: string
  verified_at?: string | null
  bank_reference?: string | null
  notes?: string | null
  internal_notes?: string | null
  recorded_by_user_id: number
  recorded_by_username?: string | null
  verified_by_user_id?: number | null
  verified_by_username?: string | null
  debt_contract_number?: string | null
  seller_name?: string | null
  is_deleted: boolean
}

export interface ClientPaymentHistoryResponse {
  client_id: number
  total_payments: number
  total_amount_paid: string
  current_debt: string
  payments: PaymentResponse[]
  page: number
  limit: number
}

// --- Task Response Types ---

export interface TaskResponse {
  id: number
  project_id: number
  client_id?: number | null
  debt_id?: number | null
  related_call_id?: number | null
  subject_id?: number | null
  subject_name?: string | null
  subject_code?: string | null
  title: string
  description?: string | null
  priority: string
  status: string
  due_date?: string | null
  reminder_date?: string | null
  is_overdue: boolean
  assigned_to_user_id?: number | null
  assigned_to_username?: string | null
  created_by: number
  created_by_name?: string | null
  created_at: string
  updated_at?: string | null
  completed_at?: string | null
  comment_count?: number
  internal_notes?: string | null
  client_name?: string | null
  is_dismissed?: boolean
}

export interface TaskCommentResponse {
  id: number
  task_id: number
  content: string
  user_id: number
  user_name?: string | null
  created_at: string
}

export interface TaskDetailResponse extends TaskResponse {
  comments: TaskCommentResponse[]
}

export interface TaskListResponse {
  tasks: TaskResponse[]
  total: number
  skip: number
  limit: number
}

export interface TaskSubjectResponse {
  id: number
  code: string
  name: string
  name_uk?: string | null
  name_en?: string | null
  name_ru?: string | null
  is_active: boolean
}

// --- Interaction Response Types ---

export interface InteractionResponse {
  id: number
  project_id: number
  client_id: number
  debt_id?: number | null
  type_id?: number | null
  subtype_id?: number | null
  result_id?: number | null
  direction?: string | null
  channel?: string | null
  status: string
  interaction_date: string
  duration_seconds?: number | null
  phone_used?: string | null
  phone_label?: string | null
  contact_person?: string | null
  contact_relationship?: string | null
  summary?: string | null
  notes?: string | null
  promise_to_pay_date?: string | null
  promise_to_pay_amount?: string | null
  promise_fulfilled?: boolean | null
  promise_fulfilled_date?: string | null
  promise_partial_amount?: string | null
  follow_up_required?: boolean
  follow_up_date?: string | null
  follow_up_notes?: string | null
  region?: string | null
  wants_principal_only?: boolean | null
  delay_reason_id?: number | null
  refusal_reason_id?: number | null
  next_action_date?: string | null
  next_action_type?: string | null
  related_call_id?: number | null
  related_sms_id?: number | null
  related_payment_id?: number | null
  user_id: number
  user_name?: string | null
  legacy_id?: string | null
  number_k?: string | null
  created_at: string
  updated_at?: string | null
  is_deleted?: boolean
  contact_type_id?: number | null
  // Resolved reference names
  type_name?: string | null
  type_code?: string | null
  subtype_name?: string | null
  subtype_code?: string | null
  contact_type_name?: string | null
  contact_type_code?: string | null
  result_name?: string | null
  result_code?: string | null
  result_is_positive?: boolean | null
  delay_reason_name?: string | null
  refusal_reason_name?: string | null
}

export interface InteractionListResponse {
  items: InteractionResponse[]
  total: number
  page: number
  page_size: number
}

export interface DialHistoryRecord {
  id: number
  legacy_interaction_id: string
  client_id: number
  project_id: number
  phone?: string | null
  interaction_date?: string | null
  created_at: string
}

export interface DialHistoryListResponse {
  records: DialHistoryRecord[]
  total: number
  skip: number
  limit: number
}

export interface InteractionTypeResponse {
  id: number
  code: string
  name: string
  is_active: boolean
  sort_order: number
}

export interface InteractionSubtypeResponse {
  id: number
  type_id?: number | null
  code: string
  name: string
  description?: string | null
  is_active: boolean
  sort_order: number
}

export interface InteractionContactTypeResponse {
  id: number
  code: string
  name: string
  description?: string | null
  is_active: boolean
  sort_order: number
}

export interface InteractionResultResponse {
  id: number
  code: string
  name: string
  result_category?: string | null
  is_positive?: boolean | null
  requires_followup: boolean
  requires_promise_date?: boolean | null
  requires_promise_amount?: boolean | null
  creates_task?: boolean | null
  positive_score?: number | null
  negative_score?: number | null
  is_active: boolean
  sort_order: number
}

// --- Call/SMS Response Types ---

export interface CallRecord {
  call_id: string
  client_id: number | null
  agent_extension: string
  customer_number: string
  caller_id_name?: string | null
  caller_id_number?: string | null
  campaign_id?: string | null
  state: string
  uniqueid?: string | null
  initiated_at: string
  ringing_at?: string | null
  answered_at?: string | null
  ended_at?: string | null
  ring_duration?: number | null
  talk_duration?: number | null
  total_duration?: number | null
  recording_path?: string | null
  outcome?: string | null
  disposition?: string | null
  notes?: string | null
  call_metadata?: Record<string, unknown> | null
  hangup_cause?: number | null
}

export interface SmsRecord {
  id: number
  client_id: number
  direction: string
  phone_number: string
  status: string
  content?: string | null
  template_name?: string | null
  sent_at?: string | null
  delivered_at?: string | null
  created_at: string
}
