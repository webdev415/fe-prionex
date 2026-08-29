/**
 * Типы кредитного модуля — по контракту credit-module (contracts/openapi.yaml v0.1.4).
 *
 * Источник истины — контракт модуля, а не эти типы: при расхождении правится
 * контракт, потом код. Денежные величины везде в minor units (копейки/центы),
 * как их отдаёт сервис, — форматирование только на границе отображения.
 */

/** Состояния заявки (ApplicationStatus контракта). */
export type CreditApplicationStatus =
  | 'draft'
  | 'in_progress'
  | 'abandoned'
  | 'identity_check'
  | 'data_collection'
  | 'scoring'
  | 'approved'
  | 'referred'
  | 'declined'
  | 'contracted'
  | 'expired'
  | 'disbursed'

/** Статусы, которые реально попадают в операторскую очередь. */
export const CREDIT_APPLICATION_STATUSES: CreditApplicationStatus[] = [
  'in_progress',
  'scoring',
  'referred',
  'approved',
  'declined',
  'expired',
  'contracted',
  'disbursed',
]

export type CreditDecisionOutcome = 'approved' | 'declined' | 'referred'
export type CreditDecisionMode = 'automatic' | 'manual' | 'override'

/** Строка списка заявок (ApplicationSummary). */
export interface CreditApplicationSummary {
  application_id: string
  number: string
  status: CreditApplicationStatus
  product_code: string
  channel: string
  jurisdiction: string
  currency: string
  requested_amount_minor: number
  client_email: string | null
  external_application_id?: string | null
  project?: string | null
  created_at: string
  updated_at: string
  decision_outcome: CreditDecisionOutcome | null
  decision_mode: CreditDecisionMode | null
  final_amount_minor: number | null
}

export interface CreditDecision {
  decision_id: string
  application_id: string
  outcome: CreditDecisionOutcome
  decision_mode: CreditDecisionMode
  decline_codes: string[]
  final_amount_minor: number | null
  currency: string
  cooldown_until: string | null
  ruleset_version: string
  model_version: string
  input_snapshot_id: string
  input_snapshot?: Record<string, unknown>
  underwriter_id: number | null
  rationale: string | null
  overrides_decision_id: string | null
  decided_at: string
}

export interface CreditConsent {
  kind: string
  text_version: string
  granted: boolean
  granted_at?: string
}

export interface CreditTransition {
  from_status: CreditApplicationStatus | null
  to_status: CreditApplicationStatus
  actor: string
  at: string
}

export interface CreditDocumentMeta {
  document_id: string
  application_id: string | null
  loan_id: string | null
  client_id: number | null
  debt_id: number | null
  client_document_id: string | null
  kind: string
  title?: string
  content_type?: string | null
  size_bytes?: number | null
  template_version?: string
  sha256: string
  generated_at: string
  replaces_document_id?: string
}

/**
 * Анкета заявки: блоки ведёт сайт (web-credit `packages/application-flow`),
 * состав растёт — модуль хранит их как есть.
 *
 * Боевые блоки: `personal`, `phones`, `address`, `income`, `params`.
 * `applicant` — формат демо-заявок стенда, который ещё встречается в базе.
 * Разбор обоих — в `normalizeDraft` (`features/credit/api/draft.ts`).
 */
export interface CreditApplicationDraft {
  personal?: {
    first_name?: string
    last_name?: string
    birth_date?: string
    gender?: string
  }
  /**
   * Две живые формы: `{primary: {...}}` (сайт web-credit) и
   * `{items: [...]}` (операторский/скриптовый вход). Разбор — в normalizeDraft.
   */
  phones?: {
    items?: Array<{ kind?: string; number?: string; is_primary?: boolean }>
    primary?: { kind?: string; number?: string }
  }
  address?: { line1?: string; city?: string; province?: string; postal_code?: string }
  income?: {
    net_amount_minor?: number
    frequency?: string
    paydays?: string[]
    receipt_method?: string
    employment_status?: string
    /** демо-формат стенда */
    employer?: string
    next_payday?: string
  }
  params?: {
    amount_minor?: number
    referral_source?: string
    /** демо-формат стенда */
    requested_amount_minor?: number
  }
  /** Демо-заявки стенда: единый блок вместо personal/phones. */
  applicant?: {
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    date_of_birth?: string
  }
  banking?: { institution?: string; verified?: boolean }
  demo_note?: string
  [block: string]: unknown
}

/** Карточка заявки целиком (InternalApplication + анкета и документы). */
export interface CreditApplicationDetail extends CreditApplicationSummary {
  project_id: number
  /** null до перехода approved → contracted (upsert клиента, C-08). */
  client_id: number | null
  decision_id: string | null
  loan_id: string | null
  resume_step?: string
  missing_fields?: string[]
  expires_at?: string | null
  paydays: string[]
  consents: CreditConsent[]
  audit: CreditTransition[]
  draft: CreditApplicationDraft
  documents?: CreditDocumentMeta[]
  decision?: CreditDecision
  ibv?: Record<string, unknown>
  sign_evidence?: Record<string, unknown>
}

export type CreditLoanStatus =
  | 'active'
  | 'delinquent'
  | 'closed'
  | 'cancelled'
  | 'written_off'
  | 'charged_off'

/** Строка списка кредитов. */
export interface CreditLoanSummary {
  loan_id: string
  contract_number: string
  product_code: string
  status: CreditLoanStatus
  currency: string
  principal_minor: number
  total_payable_minor: number
  delinquency_days: number
  client_email: string | null
  disbursed_at: string
  maturity_date: string
  application_id: string
}

/** Паспорт кредита (InternalLoan). */
export interface CreditLoanDetail {
  loan_id: string
  contract_number: string
  product_code: string
  product_version: string
  status: CreditLoanStatus
  currency: string
  principal_minor: number
  balance_total_minor: number
  project_id: number
  /** null до этапа 2 (C-08): связь с CRM появляется при выдаче. */
  client_id: number | null
  debt_id: number | null
  application_id: string
  origin: 'credit_module'
  jurisdiction: string
  schedule_version: number
  delinquency_days: number
  regulatory_package_version?: string
  prepayment_mode?: string
  close_reason?: string
  disbursed_at: string
  maturity_date: string
  next_payment?: { due_date: string; amount_minor: number }
}

export interface CreditScheduleItem {
  seq: number
  due_date: string
  principal_minor?: number
  interest_minor?: number
  fee_minor?: number
  total_minor: number
  balance_after_minor?: number
  status?: 'scheduled' | 'paid' | 'partially_paid' | 'overdue'
}

export interface CreditScheduleVersion {
  version: number
  effective_date: string
  reason: string
  items?: CreditScheduleItem[]
}

export interface CreditJournalEntry {
  entry_id: string
  seq: number
  entry_type: string
  bucket: string
  amount_minor: number
  currency: string
  business_date: string
  effective_date: string
  posted_at: string
  installment_seq?: number
  reversal_of_entry_id?: string
  rule_id?: string
  rule_version?: string
}

/** Состояние кредита на срез as_of — истина ядра (совпадает с replay). */
export interface CreditLoanState {
  loan_id: string
  status: CreditLoanStatus
  currency: string
  as_of: string
  balances: {
    total_due_minor: number
    principal_minor?: number
    interest_minor?: number
    fees_minor?: number
    penalties_minor?: number
    [bucket: string]: number | undefined
  }
  delinquency: {
    delinquency_days: number
    arrears_flag?: boolean
    no_contact_flag?: boolean
    default_reported_at?: string
  }
  schedule?: CreditScheduleVersion
  payments?: Array<{
    payment_id: string
    effective_date: string
    amount_minor: number
    allocation?: Record<string, number>
  }>
}

/** Позиция очереди ручного разбора (UnderwritingQueueItem). */
export interface CreditQueueItem {
  application_id: string
  decision_id?: string
  status: 'pending' | 'in_review' | 'done'
  assigned_to: number | null
  referred_at: string
  requested_amount_minor?: number
  currency?: string
  product_code?: string
  review_reasons?: string[]
}

/** Конвенция обёртки списков контракта. */
export interface CreditPage<T> {
  items: T[]
  next_cursor?: string | null
  total?: number
}

export interface CreditApplicationsParams {
  status?: CreditApplicationStatus[]
  query?: string
  limit?: number
  cursor?: string
}

export interface CreditLoansParams {
  status?: CreditLoanStatus[]
  limit?: number
  cursor?: string
}

export interface ManualDecisionPayload {
  outcome: CreditDecisionOutcome
  rationale: string
  final_amount_minor?: number
  decline_codes?: string[]
  cooldown_until?: string
  underwriter_id?: number
}

/** Сводка стенда: счётчики и права текущей роли (демо-контур этапа 1). */
export interface CreditOverview {
  role: string
  permissions: string[]
  roles_available: string[]
  applications: Record<string, number>
  loans: Record<string, number>
  application_statuses: CreditApplicationStatus[]
  demo_mode: boolean
}

/** Версия продукта (каталог risk-менеджера). */
export interface CreditProductVersion {
  version: string
  state: string
  pricing_version: string | null
  valid_from: string | null
  payload: Record<string, unknown>
}

/** Продукт с версиями (listInternalProducts). */
export interface CreditProduct {
  code: string
  name: string
  project: string
  jurisdiction: string
  currency: string
  availability: string
  versions: CreditProductVersion[]
}

/** Параметр decision-engine (listParameters). */
export interface CreditParameter {
  code: string
  value: unknown
  description: string | null
  updated_at: string
}
