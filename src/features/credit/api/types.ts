/**
 * Типы кредитного модуля — по контракту credit-module (contracts/openapi.yaml v0.1.4).
 *
 * Источник истины — контракт модуля, а не эти типы: при расхождении правится
 * контракт, потом код. Денежные величины везде в minor units (копейки/центы),
 * как их отдаёт сервис, — форматирование только на границе отображения.
 */

/** Состояния заявки (ApplicationStatus контракта). */
import type { CREDIT_BUCKETS, CREDIT_ENTRY_TYPES } from './enums'

/** Тип проводки журнала — значения из перечисления контракта, не произвольная
 *  строка. Ветка «не дублировать слово сторно» сравнивает это поле с
 *  конкретным значением; при типе `string` компилятор смолчал бы на любом
 *  переименовании, и тавтология вернулась бы молча. */
export type CreditEntryType = (typeof CREDIT_ENTRY_TYPES)[number]
/** Бакет долга — аналогично: подписи строк разнесения читаются по значению. */
export type CreditBucket = (typeof CREDIT_BUCKETS)[number]

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
  /**
   * Шаг анкеты, на котором стоит клиент. Без него очередь — тысяча с лишним
   * неразличимых «Заповнюється»: видно, что заявка не дошла, и не видно, где
   * именно она встала.
   *
   * ⚠️ Необязательное по той же причине, что и `client_standing`: поле
   * добавлено в сводку модуля коммитом 452cc71 и на стенде ещё не развёрнуто.
   * Колонка появляется, только когда поле реально приходит (см. список заявок).
   */
  resume_step?: string | null
  /**
   * Время входа в текущий шаг — «клиент стоит здесь N часов», в отличие от
   * `updated_at` («строку N часов не трогали»).
   *
   * ⚠️ НЕ ПОКАЗЫВАЕМ, пока модуль не отдаёт признак, что значение — это
   * подстановка `created_at` для заявок старше ленты переходов. Без признака
   * старая заявка покажет «стоит 40 днів», хотя правда — «мы не знаем»;
   * догадка под видом факта хуже пустого места. Поле объявлено, чтобы связь
   * была видна в типах, и включится вместе с признаком.
   */
  step_entered_at?: string | null
  /**
   * Откуда взято `step_entered_at`: `step` — измерено по ленте переходов,
   * `created` — подставлено время создания заявки, потому что лента её не
   * застала. Признак обязателен для честной подписи: без него «стоит 40 днів»
   * читается как измерение, хотя это «мы не знаем».
   */
  step_entered_at_source?: 'step' | 'created'
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
  input_snapshot?: CreditDecisionSnapshot
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

/**
 * Положение клиента — ровно те факты, на которых машина отказывает.
 *
 * `outstanding_loans` — непогашенные займы того же клиента (правило «один
 * активный заём»), `cooldown_until` — остывание после предыдущего отказа
 * (30 дней, код отказа RC-08). Оператор решает на этом же экране, поэтому
 * основания машинного отказа должны лежать здесь, а не в соседней системе.
 *
 * ⚠️ Поле НЕОБЯЗАТЕЛЬНОЕ, и это не перестраховка: в `main` модуля его нет —
 * оно живёт в ветке `ws06/n1-refund-overpayment-obligation`, а на dev развёрнут
 * третий образ (`fix/review4-quarantine-blockers`), где оно есть. Переразвернут
 * стенд из `main` — поле исчезнет, и обязательное объявление сделало бы карточку
 * лживой, а не сломанной. Станет частью `main` — снять `?` и завести утверждение
 * в `contractAssumptions.ts`.
 */
export interface CreditClientStanding {
  /** Непогашенные займы. Показываем номер договора и статус. */
  outstanding_loans: CreditOutstandingLoan[]
  /** Дата окончания остывания после отказа; `null` — остывания нет. */
  cooldown_until: string | null
}

/** Строка непогашенного займа в положении клиента. */
export interface CreditOutstandingLoan {
  contract_number: string
  status: string
}

/** Карточка заявки целиком (InternalApplication + анкета и документы). */
export interface CreditApplicationDetail extends CreditApplicationSummary {
  project_id: number
  /** Телефон клиента приходит на самой заявке: анкета его не дублирует. */
  client_phone?: string | null
  /** null до перехода approved → contracted (upsert клиента, C-08). */
  client_id: number | null
  decision_id: string | null
  loan_id: string | null
  resume_step?: string
  missing_fields?: string[]
  client_standing?: CreditClientStanding | null
  expires_at?: string | null
  paydays: string[]
  consents: CreditConsent[]
  audit: CreditTransition[]
  draft: CreditApplicationDraft
  documents?: CreditDocumentMeta[]
  decision?: CreditDecision
  ibv?: CreditIbv
  sign_evidence?: CreditSignEvidence
}

/**
 * Результат банковской верификации (IBV).
 *
 * Ради этого блока верификатор и открывает заявку: здесь ПОДТВЕРЖДЁННЫЙ банком
 * доход против заявленного, счёт для выплаты, совпадение личности и риск-
 * атрибуты. Поля объявлены опциональными: состав зависит от провайдера, а на
 * стенде работает `mock` — верить его цифрам как боевым нельзя.
 */
export interface CreditIbv {
  status?: string
  callback_status?: string
  provider?: string
  received_at?: string
  session_id?: string
  ibv_session_id?: string
  parser_version?: string
  /** Доля совпадения ФИО заявителя с держателем счёта, 0..1. */
  identity_match_rate?: number
  payout_account_id?: string
  selected_account_id?: string
  eft_capable_account_ids?: string[]
  payout_account_ambiguous?: boolean
  projected_paydays?: string[]
  accounts?: CreditIbvAccount[]
  income?: {
    employer_name?: string
    net_amount_minor?: number
    employer_income_frequency?: string
    paydays_source?: string
    observed_paydays?: string[]
  }
  risk?: {
    count_nsf_90_days?: number
    balance_trend_simple?: string
    count_distinct_micro_lenders?: number
    extra?: Record<string, number | boolean>
  }
  payday_reconciliation?: {
    dates_match?: boolean
    needs_review?: boolean
    frequency_matches?: boolean
    detected_frequency?: string
    application_frequency?: string
    projected_paydays?: string[]
    application_paydays?: string[]
  }
}

export interface CreditIbvAccount {
  account_id: string
  title?: string
  category?: string
  currency?: string
  account_type?: string
  account_number?: string
  transit_number?: string
  institution_number?: string
  holder_name?: string
  holder_address?: string
  eft_capable?: boolean
  balance_current_minor?: number
}

/** Доказательство подписи (DOC-06): чем именно клиент подписал договор. */
export interface CreditSignEvidence {
  method?: string
  typed_name?: string
  signed_at?: string
  received_at?: string
  session_id?: string
  pdf_sha256?: string
  ip?: string | null
  user_agent?: string | null
  otp_ref?: string | null
}

/**
 * Снимок входов решения (DAT-02) — цифры, на которых построен исход.
 * Хранится в решении неизменяемым: через год именно он объясняет, почему
 * выдали или отказали.
 */
export interface CreditDecisionSnapshot {
  requested_amount_minor?: number
  net_amount_minor_per_period?: number
  effective_net_amount_minor_per_period?: number
  monthly_equivalent_minor?: number
  affordability_cap_minor?: number
  active_loans?: number
  frequency?: string
  prior_decline_cooldown_until?: string | null
  product_bounds_minor?: { min?: number; max?: number; step?: number }
  /**
   * Сверка заявленного дохода с подтверждённым банком.
   * Имена полей и типы — по фактическому ответу сервиса: проценты приходят
   * decimal-СТРОКОЙ («0.70»), суммы — целыми minor units.
   */
  income_reconciliation?: {
    declared_net_amount_minor?: number
    verified_net_amount_minor?: number
    effective_net_amount_minor_per_period?: number
    monthly_declared_minor?: number
    monthly_verified_minor?: number
    monthly_effective_minor?: number
    divergence_pct?: string | number
    tolerance_pct?: string | number
    needs_review?: boolean
    review_reason?: string | null
    frequency_source?: string
    frequency_matches?: boolean
    declared_frequency?: string
    detected_frequency?: string
  }
  rules?: { decline_codes?: Record<string, string> } & Record<string, unknown>
  ibv?: Record<string, unknown>
}

/** Полный enum LoanStatus контракта — НЕ сокращать до встреченного в БД. */
export type CreditLoanStatus =
  | 'pending_disbursement'
  | 'active'
  | 'delinquent'
  | 'forbearance'
  | 'protected'
  | 'charged_off'
  | 'closed'
  | 'written_off'
  | 'withdrawn'
  | 'cancelled'
  | 'disbursement_failed'
  | 'funding_exception'

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
  paid_minor?: number
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
  entry_type: CreditEntryType
  bucket: CreditBucket
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

/**
 * Разбивка долга по корзинам.
 *
 * Поля перечислены явно и БЕЗ индексной сигнатуры: раньше `[bucket: string]`
 * глушила опечатки — код читал `fees_minor`/`penalties_minor`, которых ядро
 * не отдаёт (там `fee_minor`/`penalty_minor`), и вместо цифры молча выходил
 * прочерк. `*_charged_minor` — начислено за всё время, без суффикса — осталось
 * к уплате; их разность и есть «уплачено».
 */
export interface CreditBalances {
  total_due_minor: number
  overdue_minor: number
  principal_minor: number
  interest_minor: number
  fee_minor: number
  commission_minor: number
  penalty_minor: number
  fine_minor: number
  overpayment_minor: number
  principal_charged_minor: number
  interest_charged_minor: number
  fee_charged_minor: number
  commission_charged_minor: number
  penalty_charged_minor: number
  fine_charged_minor: number
  total_charged_minor: number
  default_interest_minor: number
  nsf_fees_minor: number
}

/** Регуляторные проверки продукта: любое false — кредит вне рамок. */
export interface CreditCaps {
  term_window_42_62_ok: boolean
  instalment_spread_ok: boolean
  min_instalments_ok: boolean
  instalments_on_paydays_ok: boolean
  cost_of_borrowing_cap_ok: boolean
  federal_s347_1_exemption_ok: boolean
}

/**
 * Разнесение платежа по корзинам — МАССИВ (контракт: POR-02), а не словарь.
 * Чтение через `Object.entries` давало ключ «0» и объект вместо суммы: на
 * экране получалось «0 NaN» вместо «Комісія 10,00».
 */
export interface CreditPaymentAllocation {
  bucket: CreditBucket
  amount_minor: number
  installment_seq?: number
}

export interface CreditPayment {
  payment_id: string
  effective_date: string
  amount_minor: number
  /**
   * Состояние платежа. Сторнированный платёж В ДОЛГ НЕ ЗАСЧИТАН: деньги
   * вернулись банку, обязательство восстановлено. Поле обязательное, потому
   * что модуль отдаёт его всегда — ветка «поля нет, считаем обычным»
   * замаскировала бы дефект модуля вместо того, чтобы его показать.
   */
  state: 'accepted' | 'reversed'
  /** Учётная дата сторно из журнала — НЕ дата нажатия кнопки и не
   * `effective_date` платежа: возврат приходит позже, иногда сильно. */
  reversed_on: string | null
  allocation?: CreditPaymentAllocation[]
  receipt_document_id?: string
}

/**
 * Состояние кредита на срез as_of — истина ядра (совпадает с replay).
 * Надмножество паспорта: те же паспортные поля плюс балансы и проверки.
 */
export interface CreditLoanState {
  loan_id: string
  contract_number: string
  product_code: string
  product_version: string
  jurisdiction: string
  status: CreditLoanStatus
  currency: string
  as_of: string
  principal_minor: number
  balance_total_minor: number
  paid_minor: number
  maturity_date: string
  disbursed_at: string
  next_payment?: { due_date: string; amount_minor: number }
  cancellation_window_until?: string
  regulatory_package_version?: string
  origin?: string
  project_id?: number
  balances: CreditBalances
  delinquency: {
    delinquency_days: number
    arrears_flag?: boolean
    no_contact_flag?: boolean
    default_reported_at?: string
  }
  caps?: CreditCaps
  flags?: { validation_valid: boolean; delinquency_bucket: string }
  schedule?: CreditScheduleVersion
  payments?: CreditPayment[]
}

/**
 * Статус позиции очереди ручного разбора.
 *
 * Вынесен из `CreditQueueItem` отдельным типом: тем же перечнем ограничен
 * единственный серверный фильтр очереди, и общий тип не даёт им разойтись —
 * значение вне перечня модуль встречает 422, а не молчаливым «показал всё».
 */
export type CreditQueueStatus = 'pending' | 'in_review' | 'done'

/** Позиция очереди ручного разбора (UnderwritingQueueItem). */
export interface CreditQueueItem {
  application_id: string
  decision_id?: string
  status: CreditQueueStatus
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
  sort?: string
  limit?: number
  cursor?: string
}

export interface CreditLoansParams {
  status?: CreditLoanStatus[]
  query?: string
  dpd_min?: number
  dpd_max?: number
  disbursed_from?: string
  disbursed_to?: string
  /** Поле сортировки; `-` в начале — по убыванию. */
  sort?: string
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

/* ─── Рубильники продукта ──────────────────────────────────────────────── */

/**
 * Три независимых рубильника модуля.
 *
 * Доменное правило одно и оно денежное: **выключение = запрет НОВОГО**.
 * Обслуживание выданных кредитов не останавливается никогда — платежи
 * принимаются, график и документы отдаются, двухдневное право на отказ
 * действует. Иначе клиента наказывают за наш рубильник: платить он не может,
 * а проценты идут.
 *
 * `crm_section` модуль ХРАНИТ И ОТДАЁТ, но сам по нему ничего не запрещает:
 * раздел в CRM — витрина оператора, а оператор обслуживает выданные кредиты.
 * Скрывает раздел та сторона, которой он принадлежит, — то есть мы.
 */
export type CreditSwitchName = 'applications_intake' | 'client_cabinet' | 'crm_section'

export type CreditSwitches = Record<CreditSwitchName, boolean>

/** Строка истории переключений. Она же аудит: отдельного журнала нет намеренно. */
export interface CreditSwitchChange {
  switch: CreditSwitchName
  enabled: boolean
  /** Роль оператора (этап 1); идентификатор из JWT появится с WS-20. */
  actor: string
  reason: string | null
  occurred_at: string
}

export interface CreditSwitchState {
  switches: CreditSwitches
  /** Новые сверху. */
  history: CreditSwitchChange[]
}

/** Тело переключения. `reason` не обязателен контрактом, но обязателен по делу. */
export interface CreditSwitchPayload {
  enabled: boolean
  reason?: string | null
}
