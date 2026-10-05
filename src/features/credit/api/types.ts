/**
 * Типы кредитного модуля — по контракту credit-module (contracts/openapi.yaml v0.1.4).
 *
 * Источник истины — контракт модуля, а не эти типы: при расхождении правится
 * контракт, потом код. Денежные величины везде в minor units (копейки/центы),
 * как их отдаёт сервис, — форматирование только на границе отображения.
 */

/** Состояния заявки (ApplicationStatus контракта). */
import type { CREDIT_BUCKETS, CREDIT_CHECKLIST_KEYS, CREDIT_ENTRY_TYPES } from './enums'

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

/**
 * Чек-лист и условное одобрение ручного решения — контракт модуля 0.1.30/0.1.31
 * (19-5), сверено с `main` модуля 0852c782 — `openapi.yaml` `DecisionChecklistItem`,
 * `Decision`. Пункт — из листа книги (`CREDIT_CHECKLIST_KEYS`).
 */
export type CreditChecklistKey = (typeof CREDIT_CHECKLIST_KEYS)[number]
export type CreditChecklistAnswer = 'yes' | 'no' | 'n_a'
/** Пункт в снимке решения: `note` модуль кладёт всегда, `null` — примечания нет. */
export interface CreditChecklistItem {
  key: CreditChecklistKey
  answer: CreditChecklistAnswer
  note: string | null
}
/** Заполненность чек-листа: `applicable` — пункты листа минус `n_a`. Долю считает модуль. */
export interface CreditChecklistCompleted {
  yes: number
  applicable: number
}
/** `proposed` — предложение андеррайтера (решение `referred`), `confirmed` — подтверждено руководителем. */
export type CreditConditionalStage = 'proposed' | 'confirmed'

/** `input_snapshot.conditional` — `Decision.input_snapshot.conditional` контракта 0.1.30/0.1.31. */
export interface CreditConditionalSnapshot {
  stage: CreditConditionalStage
  /** Коды условия `AB-C-*`. */
  codes: string[]
  /** Сумма, которую одобряет подтверждение. */
  amount_minor: number
  proposal_decision_id?: string
  proposed_by?: number | null
  confirmed_by?: number | null
  confirmed_at?: string
}

/** Согласие на рекламные cookie на момент отправки заявки (`ApplicationMarketing.consent_ads`). */
export type CreditAttributionConsent = 'granted' | 'denied' | 'unknown'

/**
 * Рекламные метки заявки (ApplicationMarketing, контракт модуля 0.1.44, 18-13):
 * девять ключей присутствуют всегда, `null` — метки не было или модуль её
 * отбросил при приёме. Показ пустоты как `(not set)` — дело CRM (`attribution.ts`).
 */
export interface CreditApplicationMarketing {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  gclid: string | null
  /** Идентификатор клика партнёра, как прислан: по нему уходит постбек. */
  click_id: string | null
  consent_ads: CreditAttributionConsent | null
  /** Момент клика, RFC 3339 со смещением. */
  click_at: string | null
}

/** Строка списка заявок (ApplicationSummary). */
export interface CreditApplicationSummary {
  application_id: string
  number: string
  /**
   * Метки заявки. В контракте `required`, здесь `?`: стенд модуля старше 18-13
   * поля не пришлёт, и карточка обязана показать `(not set)`, а не упасть.
   */
  marketing?: CreditApplicationMarketing
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
  /** Коды, как их записало решение: у ручного — как прислал оператор (`RC-04` остаётся `RC-04`). */
  decline_codes: string[]
  /**
   * Смысл отказа кодами реестра решения (`AB-*`, v0.1.27): `RC-04` → `AB-O-05`,
   * `RC-08` → `AB-X-08`, `RC-11` — по установленной причине, плюс присланные
   * оператором коды реестра. Пусто у одобренных и у отказов, причина которых не
   * сохранена или не установлена.
   *
   * В контракте поле required; здесь НЕОБЯЗАТЕЛЬНОЕ намеренно: у модуля старше
   * 0.1.27 ключа нет, и карточка обязана показать такое решение прежним
   * словарём `credit.declineCode`, а не пустой строкой (прецедент — ключ
   * `supersedes_decision_id` у модуля старше B-3).
   */
  decision_codes?: string[]
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
  /**
   * Решение, которое это ЗАМЕНИЛО: модуль пересмотрел своё автоматическое
   * решение после смены реквизитов выплаты. `null` — ничего не заменяло. Не
   * путать с `overrides_decision_id` — там переопределил человек.
   *
   * В контракте поле не required; здесь required, чтобы каждая фикстура
   * назвала значение: модуль кладёт ключ всегда (строка или `null`). Ключа нет
   * только у модуля старше B-3 (17.09): ключ и сам пересмотр пришли одной
   * правкой, такой модуль решений не заменяет — поэтому экран показывает
   * отсутствие ключа как `null`, и это правда, а не незнание. У излишка иначе:
   * события пишутся с 31.08, ключ — с 17.09.
   */
  supersedes_decision_id: string | null
  decided_at: string
  /**
   * Заполненность чек-листа (контракт модуля 0.1.30/0.1.31, 19-5, `Decision`);
   * `null` — решение без чек-листа. В контракте поле required; здесь
   * НЕОБЯЗАТЕЛЬНОЕ: у модуля старше 19-5 (PROD) ключа нет, и карточка обязана
   * это пережить.
   */
  checklist_completed?: CreditChecklistCompleted | null
  /** Ступень условного одобрения (0.1.30/0.1.31, 19-5); `null` — без условия. Необязательно — довод выше. */
  conditional_stage?: CreditConditionalStage | null
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
  /**
   * Отдаст ли модуль содержимое документа по своим записям (одноимённое поле
   * `DocumentMeta` контракта). Там оно необязательно, здесь обязательно: модуль
   * кладёт его всегда, а необязательное фикстуры забывали бы молча. `false` —
   * выдавать нечего, кнопка говорит это до нажатия; `true` не обещает, что файл
   * на месте (503 `document_file_missing`).
   */
  content_available: boolean
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

/** Признак, по которому модуль сравнивал клиентов — `ApplicantApplications.identity_keys` (openapi.yaml модуля v0.1.26). */
export type CreditIdentityKey = 'email' | 'national_id'

/** Строка другой заявки того же клиента — `ApplicantApplicationRow` (openapi.yaml модуля v0.1.26), ровно пять полей. */
export interface CreditApplicantApplication {
  application_id: string
  number: string
  status: CreditApplicationStatus | string
  created_at: string
  decision_outcome: CreditDecisionOutcome | null
}

/** Другие заявки того же клиента в проекте оператора — `ApplicantApplications` (openapi.yaml модуля v0.1.26). */
export interface CreditApplicantApplications {
  /** Все другие заявки клиента, текущая не входит; не меньше длины `items`. */
  total: number
  /** Последние по `created_at` (по убыванию), не больше двадцати. */
  items: CreditApplicantApplication[]
  /** По каким признакам текущей заявки сравнивали; `[]` — сравнивать не с чем. */
  identity_keys: CreditIdentityKey[]
}

/** Переход статуса в строке хронологии — `InternalApplication.timeline.items.transition` (openapi.yaml модуля v0.1.26); шире `CreditTransition`: статусы строкой, актор может быть `null`. */
export interface CreditTimelineTransition {
  from_status: string | null
  to_status: string
  actor: string | null
  at: string
}

/** Событие клиента в строке хронологии — `InternalApplication.timeline.items.client` (openapi.yaml модуля v0.1.26). */
export interface CreditTimelineClient {
  event: string
  source: 'landing' | 'cabinet'
  scope: 'application' | 'client'
  who?: string
  seq?: number | null
  details?: Record<string, unknown>
  event_ids?: string[]
}

/** Строка хронологии карточки заявки — `InternalApplication.timeline.items` (openapi.yaml модуля v0.1.26); в `required` только четыре поля. */
export interface CreditTimelineRow {
  track: 'client' | 'status'
  at: string
  last_at: string
  count: number
  client?: CreditTimelineClient | null
  transition?: CreditTimelineTransition | null
}

/** Событие сайта, привязанное к заявке или кредиту — `PortalEventRecord` (openapi.yaml модуля v0.1.26); объявлен минимум, который читается. */
export interface CreditPortalEventRecord {
  event_id: string
  ts: string
  source: string
  event: string
  /**
   * Дополнительные поля события — плоский словарь скаляров (`PortalEvent.details`).
   * Читается вид письма-уведомления: `details.type` — код повода модуля. `?` — в
   * `required` контракта поля нет.
   */
  details?: Record<string, unknown>
}

/**
 * Строка следа показанных правовых текстов — `LegalTextShownRecord`
 * (`openapi.yaml:7426` модуля 0.1.48, `45c4d6b2`; все восемь полей required).
 * Экран читает поле только через `readLegalTrail` (`legalTrail.ts`): тип — то,
 * что обещает контракт, а не то, во что верит рендер.
 */
export interface CreditLegalTextShown {
  /** `legal-texts | site-documents` по контракту; иное экран показывает как пришло. */
  source: string
  /** Ключ строки CMS (`sign.max_cost`) или вид документа (`privacy_policy`) — не переводится. */
  subject: string
  /** `id` строки журнала публикаций CMS — постоянный адрес версии на стенде CMS. */
  publication_id: number
  version_no: number
  sha256: string
  locale: string
  /** Часы сайта; `null` — сайт момент не назвал. */
  shown_at: string | null
  /** Момент приёма заявки модулем. */
  received_at: string
  /** Этап показа (`intake | sign`) — появится в 0.1.49 (18-4c); в 0.1.48 поля нет. */
  door?: string
}

/** Карточка заявки целиком (InternalApplication + анкета и документы). */
export interface CreditApplicationDetail extends CreditApplicationSummary {
  project_id: number
  /**
   * Прочие присланные метки (`fbclid`, `sub_id`, …) — ключи вне девяти
   * `marketing`; `null` — прочих не было. Только в карточке. `?` — как у `marketing`.
   */
  marketing_other?: Record<string, string> | null
  /** Телефон клиента приходит на самой заявке: анкета его не дублирует. */
  client_phone?: string | null
  /** null до перехода approved → contracted (upsert клиента, C-08). */
  client_id: number | null
  decision_id: string | null
  loan_id: string | null
  resume_step?: string
  missing_fields?: string[]
  /**
   * ЭТАП ПУТИ — ответ модуля, а не расчёт CRM: `getInternalApplication` →
   * `InternalApplication` (`openapi.yaml:7236`) = `allOf Application` (`:5671`),
   * поля `:5680`/`:5690`/`:5699`. `?` — ни одно не в `required`
   * (`ApplicationRef.required = [application_id, status]`, `:5659`): стенд,
   * отстающий от контракта, их не пришлёт. `| null` — как у соседних полей
   * этого же интерфейса (`client_standing`, `expires_at`): модуль вправе
   * прислать `null`, и разбор в `creditApplicationStageView` на него рассчитан.
   * `stage` типизирован `string`, а не `CreditApplicationStage` (union закрыт,
   * `applicationStages.ts`): сужение делается рантаймом, через `includes(...)`.
   */
  stage?: string | null
  stage_index?: number | null
  stage_total?: number | null
  client_standing?: CreditClientStanding | null
  expires_at?: string | null
  paydays: string[]
  consents: CreditConsent[]
  audit: CreditTransition[]
  /**
   * Хронология, события сайта и другие заявки клиента — поля `InternalApplication`
   * модуля. `?` — стенд, отстающий от контракта, их не пришлёт, и экран обязан
   * сказать «модуль не передав», а не показать пустоту или ноль.
   */
  timeline?: CreditTimelineRow[]
  portal_events?: CreditPortalEventRecord[]
  portal_events_total?: number
  applicant_applications?: CreditApplicantApplications | null
  draft: CreditApplicationDraft
  documents?: CreditDocumentMeta[]
  decision?: CreditDecision
  ibv?: CreditIbv
  sign_evidence?: CreditSignEvidence
  /**
   * След правовых текстов сайта, показанных до подачи (18-4a), в порядке приёма.
   * required в 0.1.48 (`openapi.yaml:9290`); `?` — стенд старше контракта не шлёт,
   * и тогда блока нет вовсе (у такого модуля следа быть не может).
   */
  legal_texts_shown?: CreditLegalTextShown[]
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
  /** Разбор скоринга книги (19-3; часть B — 19-4). Нет у решений без флага скоринга и у ручных. */
  scorecard?: CreditScorecardSnapshot | null
  /** Класс дохода 19-2 — верхний уровень снимка, пишется и без флага скоринга. */
  income_class?: string | null
  income_class_source?: string | null
  income_class_basis?: CreditIncomeClassBasis | null
  /** Чек-лист ручного решения (0.1.30/0.1.31, 19-5): версия листа и присланные пункты в порядке листа. */
  checklist?: { version: string; items: CreditChecklistItem[] }
  /** Условное одобрение (0.1.30/0.1.31, 19-5): есть у предложения и у подтверждения. */
  conditional?: CreditConditionalSnapshot
}

/**
 * `input_snapshot.scorecard` — баллы, банд и гейт книги правил проверки клиента.
 *
 * ⚠️ В контракте модуля 0.1.28 ключ НЕ объявлен (`Decision.input_snapshot` —
 * свободный объект), поэтому в `contractAssumptions.ts` утверждений о нём нет:
 * утверждать нечего. Тип написан руками по коду модуля: 19-3 —
 * `_scorecard_snapshot` и `ScorecardResult.as_dict` на `main` `7934c035`
 * (`inputs` — все 15 полей `ScorecardInputs` плюс `missing`); часть B — по story
 * 19-4 AC-14, её кода на 29.09 нет. Все поля необязательны и допускают `null`:
 * форма обязана терпеть снимок старшей или младшей версии по построению.
 */
export interface CreditScorecardSnapshot {
  version?: string | null
  income_class?: string | null
  income_class_source?: string | null
  /** Вход целиком; `missing` — банковские поля, которых провайдер не прислал. */
  inputs?: (Record<string, unknown> & { missing?: string[] | null }) | null
  points?: Record<string, number> | null
  total?: number | null
  band?: number | null
  gate?: {
    decline?: boolean | null
    /** Применённые коды гейта. */
    codes?: string[] | null
    /** Сработавшие, но удержанные для решения человека. */
    held?: string[] | null
    /** Причины разбора — ключи `referral_reasons` модуля. */
    review?: string[] | null
  } | null
  client_type?: number | null
  closed_loans?: number | null
  tier?: {
    min_minor?: number | null
    max_minor?: number | null
    class_b_cap_applied?: boolean | null
  } | null
  scale_amount_minor?: number | null
  cap_amount_minor?: number | null
  rounded_amount_minor?: number | null
  final_amount_minor?: number | null
  installments?: { min?: number | null; max?: number | null } | null
  /** Коды решения машины: `gate.codes` и `AB-G-06` блока суммы. */
  codes?: string[] | null
}

/**
 * `input_snapshot.income_class_basis` (19-2) — только то, что читает разбор.
 * Суммы пособий (`amounts`) и перечень неизмеренных атрибутов (`missing`) модуль
 * тоже пишет, но в тип они не входят намеренно: суммы пенсии и выплат по
 * инвалидности говорят о здоровье и социальном статусе клиента, а решение по
 * ним уже свёрнуто в признаки `evidence`.
 */
export interface CreditIncomeClassBasis {
  declared_class?: string | null
  employment_status?: string | null
  employment_status_known?: boolean | null
  b_not_confirmed?: boolean | null
  evidence?: {
    employer_income_30d?: boolean | null
    b_income?: boolean | null
    c_income?: boolean | null
  } | null
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

/**
 * Строка блока «Кредит (наш)» карточки клиента CRM — `ClientLoanCard`
 * (`listClientLoans`, дверь CM-L3 / 14-18).
 *
 * КЛАСС А границы видимости и ничего сверх (решение CEO 21.09.2026,
 * `docs/11-credit-vs-collection-boundary.md` §7 п. 2): договор и статус,
 * деньги, просрочка, даты, ссылка в модуль. График, журнал проводок, бакеты
 * балансов, детали выдачи, лента действий клиента — класс Б, они видны ПО
 * ССЫЛКЕ в модуле; анкета, IBV, решение и доказательства подписи — класс В,
 * в CRM не уезжают вовсе.
 *
 * Почему не `CreditLoanSummary` и не `CreditLoanDetail`. Первый — строка
 * портфельного списка: балансов и просроченной части в ней нет, зато есть
 * `client_email` и `application_id`, которым в карточке должника делать
 * нечего. Второй несёт класс Б целиком.
 *
 * ⚠️ Ни одного `?`: контракт объявляет все двадцать четыре ключа в `required`,
 * и отсутствие значения выражается `null`. Поле, приходящее только иногда,
 * потребитель читает как «эта версия его не отдаёт» и пишет обход
 * ([[field-that-appears-only-sometimes]]).
 */
export interface ClientLoanCard {
  loan_id: string
  contract_number: string
  product_code: string
  status: CreditLoanStatus
  /** Валюта строки: суммы форматируются по ней, а не по умолчанию карточки. */
  currency: string
  jurisdiction: string
  /** Выдано, минорные единицы. */
  principal_minor: number
  /** Остаток к оплате на `as_of`. */
  balance_total_minor: number
  /** Сумма всех разнесённых платежей. */
  paid_minor: number
  /** Просроченная часть долга на `as_of`. */
  overdue_minor: number
  /** DPD из ядра. */
  delinquency_days: number
  /** Недоимка: пропущено не менее двух платежей. */
  arrears_flag: boolean
  /** Двадцать восемь дней без контакта с клиентом. */
  no_contact_flag: boolean
  default_reported_at: string | null
  /** Момент ФАКТИЧЕСКОГО зачисления, а не подписи договора. */
  disbursed_at: string | null
  maturity_date: string
  /** Ближайший НЕОПЛАЧЕННЫЙ взнос, включая уже просроченный. */
  next_payment: { due_date: string; amount_minor: number } | null
  closed_at: string | null
  close_reason: CreditLoanCloseReason | null
  /** Момент, когда отказ от договора состоялся или был запрошен. */
  cancelled_at: string | null
  /**
   * Деньги по состоявшемуся отказу ещё НЕ вернулись. Едет рядом с нулевым
   * балансом намеренно: при отказе начисления сторнированы, и ноль значит
   * «долга по договору нет», а не «человек ничего не должен».
   */
  return_pending: boolean
  /** День, НА КОТОРЫЙ посчитана строка; один на весь ответ. */
  as_of: string
  /** День, ПО КОТОРЫЙ доведено закрытие дня по этому кредиту; `null` — прогонов не было. */
  closed_through: string | null
  /** ОТНОСИТЕЛЬНЫЙ путь внутри CRM: `/dashboard/credit/loans/{loan_id}`. */
  module_url: string | null
}

/** Причины закрытия кредита — словарь `credit.closeReason.*`. */
export type CreditLoanCloseReason = 'repaid' | 'early_settled' | 'cancelled' | 'sold'

/**
 * Обёртка ответа двери. `next_cursor` контракт объявляет, но он ВСЕГДА `null`:
 * у одного человека кредитов единицы, пагинации у двери нет (Р-7 CM-L3).
 */
export interface ClientLoanCardPage {
  items: ClientLoanCard[]
  next_cursor: string | null
}

/**
 * Отбор строк блока. `status` — ОДНО значение, а не массив: повторённый
 * параметр дверь отвергает `422 multiple_values`, неизвестное — `422
 * unknown_value`.
 */
export interface ClientLoanCardParams {
  status?: CreditLoanStatus
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
  /**
   * ⚠️ Живой модуль отдаёт здесь `null` — проверено на кредите FB-000088
   * (01.09). Тип объявлял `number` и врал: код, поверивший объявлению
   * (`balance_total_minor.toFixed()`), упал бы на любом кредите.
   *
   * Деньги оператору берутся НЕ отсюда, а из `balances.total_due_minor`
   * состояния ядра — того же среза, по которому считает модуль. Это поле
   * оставлено как есть только потому, что контракт его объявляет.
   */
  balance_total_minor: number | null
  project_id: number
  /** null до этапа 2 (C-08): связь с CRM появляется при выдаче. */
  client_id: number | null
  debt_id: number | null
  application_id: string
  origin: 'credit_module'
  jurisdiction: string
  schedule_version: number
  delinquency_days: number
  /**
   * Сколько модуль ДОЛЖЕН ВЕРНУТЬ клиенту сверх выданного: кредит снят в
   * карантине выдачи, клиент вернул больше тела. Значение последнего события
   * `AdvanceRefundExcess`; `0` — излишка нет или события не было, ключ в
   * контракте есть всегда. Обязательство перед клиентом, а не его долг: не
   * складывать с `CreditBalances.overpayment_minor` и не показывать в
   * разбивке долга.
   */
  advance_refund_excess_minor: number
  regulatory_package_version?: string
  prepayment_mode?: string
  close_reason?: string
  paid_minor?: number
  disbursed_at: string
  maturity_date: string
  next_payment?: { due_date: string; amount_minor: number }
  /**
   * События сайта, привязанные к этому кредиту, и их полное число — поля
   * `InternalLoan` модуля. Лента ограничена потолком модуля: последние события
   * по времени источника, от старых к новым; число считает все события кредита.
   * `?` — в `required` контракта их нет, и стенд, отстающий от контракта, их не
   * пришлёт: экран обязан сказать «модуль не передав». Пустой массив — законное
   * «событий не было», а не отсутствие ленты.
   */
  portal_events?: CreditPortalEventRecord[]
  portal_events_total?: number
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
 * Ход выдачи денег — последняя попытка отправки по рельсу выплаты.
 *
 * Форма снята с живого ответа dev-стенда 31.08.2026 (`GET /loans/{id}/state`,
 * 74 кредита — единственный набор ключей на все 74). Модуль отдаёт отсутствие
 * значения ЯВНЫМ `null`, а не пропуском ключа, и это его сознательное
 * решение: пропущенный ключ потребитель читает как «эта версия модуля его не
 * отдаёт» и пишет обход, а `null` говорит то, что есть. Поэтому здесь
 * `| null`, а не `?`.
 *
 * Сам блок опционален: до первой попытки отправки его в ответе нет вовсе.
 */
export interface CreditDisbursement {
  /**
   * Что стало с деньгами. Отдельная шкала от статуса кредита и склейке не
   * подлежит: статус отвечает «должен ли клиент», выплата — «где деньги».
   * Словарь закрытый: `pending` + исходы рельса (`OUTCOME_STATES`) + `unknown`.
   */
  state: 'pending' | 'settled' | 'failed' | 'cancelled' | 'reversed' | 'unknown'
  /** Канал выплаты. `pad` бывает только у списаний, у выдачи — нет. */
  method: 'interac' | 'eft'
  settled_at: string | null
  failed_at: string | null
  /**
   * Код исхода. Словарь ОТКРЫТЫЙ: сюда попадают и коды провайдера (`NSF`), и
   * наш собственный отказ (`payout_refused_pending_review`). Перевод есть не
   * у каждого — значит, `string`, а не union: union здесь был бы обещанием
   * полноты, которого модуль не даёт.
   */
  failure_code: string | null
  provider: string
  /** Ключ провайдера — живёт час; по нему ищут операцию в поддержке рельса. */
  provider_tx_id: string | null
  /** Слово провайдера как есть. Переводу не подлежит — это чужой словарь. */
  provider_status: string | null
  /** Наш ключ операции — живёт вечно, поэтому именно он идёт в переписку. */
  client_transaction_id: string
  amount_minor: number
  currency: string
  /**
   * Ответ МОДУЛЯ на «можно ли повторить»: `state ∈ {failed, cancelled,
   * reversed}` (`app/loans.py:229,281`). Гейтом кнопки быть НЕ МОЖЕТ —
   * команда возобновления принимает только `failed` и только с закрытым
   * разбором, то есть флаг шире условия команды (см. `retryVerdict`).
   */
  retry_allowed: boolean
  /**
   * Ждёт ли операция человека и почему. Измерение, независимое от `state`:
   * операция бывает зачислена и одновременно ждать разбора.
   */
  review_reason: string | null
  review_raised_at: string | null
  /**
   * Узнали мы дату зачисления или ВЫВЕЛИ её из момента наблюдения. От даты
   * выдачи считается двухдневное окно отказа CA s.124.4, и разница между
   * «известна» и «выведена» — это разница между «срок клиента посчитан» и
   * «срок клиента оценён».
   */
  provider_time_source: 'provider' | 'observed' | null
  created_at: string
  updated_at: string
}

/* ─── Операции рельса кредита (`listLoanRailOperations`) ─────────────────── */

/**
 * Все операции рельса кредита одной страницей (`LoanRailOperations`).
 *
 * Типы этого блока написаны РУКАМИ по контракту модуля на `d643378e`
 * (`contracts/openapi.yaml:8515-8962`, дверь влита 17-6c `f7f263d`). Ключи
 * сверяются с живым ответом DEV приёмкой единицы 17-6f (п. (б)): поле, которого
 * нет в ответе, на экране дало бы тихий «—», и заметить это можно только там.
 * Все ключи модуль отдаёт всегда, неизвестное — явным `null`, поэтому `| null`,
 * а не `?`. Тело колбэка, сырой ответ провайдера, реквизиты и суммы провайдера
 * дверь не отдаёт — и типы их не объявляют.
 */
export interface CreditLoanRailOperations {
  items: CreditRailOperation[]
  /** Число операций кредита; по контракту всегда равно длине `items`. */
  total: number
  /** Курсора нет: все операции кредита приходят одной страницей. */
  next_cursor: null
}

/** Операция рельса — строка журнала модуля глазами оператора (`RailOperation`). */
export interface CreditRailOperation {
  /** Наш ключ операции — живёт вечно; ключ строки на экране и якорь метки платежа. */
  client_transaction_id: string
  /** `zum`, `mock` (стенд) или `demo` — открытая строка контракта. */
  provider: string
  direction: 'disburse' | 'collect'
  /** В контракте открытая строка (`interac` / `eft`). */
  method: string
  amount_minor: number
  /**
   * В контракте `Currency` — закрытый перечень, но здесь `string`, как у
   * `CreditJournalEntry.currency`: экран валюту только печатает.
   */
  currency: string
  installment_seq: number | null
  /** Тот же словарь, что у выплаты (`Disbursement.state`). */
  state: CreditDisbursement['state']
  /** Слово Zūm дословно либо слово модуля (`NotFound`); открытый список. */
  provider_status: string | null
  /** Код Zūm, код модуля или семейство `zum_http_<статус>`; открытый список. */
  failure_code: string | null
  provider_tx_id: string | null
  /** Единственный признак того, что Zūm принял и назвал операцию. */
  provider_accepted: boolean
  /** Начало вызова рельса по часам модуля — время «передано в Zūm». */
  rail_call_started_at: string | null
  /** Вызов вернулся без ошибки — верхняя граница приёма, не время отправки. */
  rail_call_returned_at: string | null
  /**
   * Передал ли модуль операцию рельсу. Правило считает модуль:
   * `stopped_before_send` — даже при заданном моменте вызова.
   */
  submission: 'stopped_before_send' | 'rail_called' | 'not_recorded'
  /** Заведение строки журнала — ДО проверок отказа; временем отправки не является. */
  created_at: string
  /** Когда модуль в последний раз узнал исход — ответом, колбэком или сверкой. */
  observed_at: string | null
  updated_at: string
  settled_at: string | null
  failed_at: string | null
  provider_effective_at: string | null
  provider_time_source: 'provider' | 'observed' | null
  review_reason: string | null
  review_raised_at: string | null
  /** Платёж модуля, который породило списание; у выплаты всегда `null`. */
  payment_id: string | null
  status_evidence: 'callback' | 'no_callback' | null
  /** Колбэки Zūm в порядке прихода — экран порядок не меняет. */
  callbacks: CreditRailCallback[]
  /** По контракту равно длине `callbacks`; больше — экран говорит об обрезке. */
  callbacks_total: number
  /** Шаги истории операции Zūm в порядке модуля. */
  events: CreditRailEvent[]
  /** Сколько шагов отброшено модулем: имя не прочитано. */
  events_dropped: number
}

/** Колбэк Zūm по операции (`RailCallback`). */
export interface CreditRailCallback {
  received_at: string
  /** Слово Zūm; `null` — не назвал. Живая дверь отдаёт и `""` — разбирается так же. */
  status: string | null
  failure_code: string | null
  /** `false` — колбэк к деньгам не применён. */
  signature_ok: boolean
  /** `null` — модуль колбэк ещё не применил. */
  processed_at: string | null
  /** Чем связан с операцией: парой «провайдер + id» или нашим ключом операции. */
  matched_by: 'provider_tx_id' | 'client_transaction_id'
}

/** Шаг истории операции Zūm (`RailOperationEvent`): только имя и момент. */
export interface CreditRailEvent {
  /** Имя шага словами Zūm; открытый список. */
  event: string
  /** Момент по часам Zūm; `null` — читаемого момента нет. */
  occurred_at: string | null
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
  /**
   * ⚠️ Живой модуль отдаёт здесь `null` — проверено на кредите FB-000088
   * (01.09). Тип объявлял `number` и врал: код, поверивший объявлению
   * (`balance_total_minor.toFixed()`), упал бы на любом кредите.
   *
   * Деньги оператору берутся НЕ отсюда, а из `balances.total_due_minor`
   * состояния ядра — того же среза, по которому считает модуль. Это поле
   * оставлено как есть только потому, что контракт его объявляет.
   */
  balance_total_minor: number | null
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
  /** Ход выдачи денег. Отсутствует, пока не было ни одной попытки отправки. */
  disbursement?: CreditDisbursement
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
  /**
   * Чек-лист и условие решения строки (контракт модуля 0.1.30/0.1.31, 19-5,
   * `UnderwritingQueueItem`). В контракте required; здесь необязательны — модуль
   * старше 19-5 их не шлёт, и экран обязан пережить их отсутствие.
   */
  checklist_completed?: CreditChecklistCompleted | null
  /** Коды условия `AB-C-*`; `[]` — условия нет. */
  conditional_codes?: string[]
  /** Ждёт подтверждения руководителя — только действующее предложение заявки. */
  awaiting_confirmation?: boolean
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
  /** День `YYYY-MM-DD`; границы суток — по календарю юрисдикции заявки, включительно; считает модуль (`listInternalApplications`). */
  created_from?: string
  created_to?: string
  updated_from?: string
  updated_to?: string
  /**
   * Фильтры меток (18-13): точное совпадение, не подстрока. Регистр и края у
   * `utm_*` не различает модуль, у `click_id` регистр значим. Пусто — ключа нет.
   */
  utm_source?: string
  utm_campaign?: string
  click_id?: string
  /** `true` — только заявки с `click_id`, `false` — только без; нет — все. */
  has_click_id?: boolean
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

/**
 * Отбор журнала проводок на стороне СЕРВЕРА (`getLoanJournal`).
 *
 * `limit`/`cursor` здесь нет намеренно: дверь их не объявляет, а `next_cursor`
 * журнала всегда пуст — страниц у двери нет. Объявленный параметр, который
 * сервер игнорирует, читается вызывающим как работающий.
 */
export interface CreditJournalParams {
  /** Корзина отбора; значения — только из `CREDIT_BUCKETS` (см. `creditApi.loanJournal`). */
  bucket?: CreditBucket
  /** Срез на `business_date`; отбор накопительный — «по состоянию на», а не «за дату». */
  as_of?: string
}

/**
 * Вид кода реестра решения (`DecisionCodeEntry.kind`, v0.1.27): `refusal` —
 * отказ книги `AB-O`, `conditional` — условное одобрение `AB-C` (решает
 * руководитель), `gate` — автогейт калькулятора `AB-G`, `service` — служебный
 * код модуля `AB-X`.
 */
export type CreditDecisionCodeKind = 'refusal' | 'conditional' | 'gate' | 'service'

/** Раздел книги правил, к которому относится код (`DecisionCodeEntry.category`). */
export type CreditDecisionCodeCategory =
  | 'loan_terms'
  | 'identity'
  | 'bank_account'
  | 'conduct'
  | 'financial_hardship'
  | 'digital_verification'
  | 'income'
  | 'bank_statement'
  | 'employment'
  | 'service'

/** Признаки кода (`DecisionCodeEntry.traits`); на экране пока не показываются (19-5f). */
export type CreditDecisionCodeTrait =
  | 'automatic'
  | 'on_site'
  | 'ban_reapply'
  | 'supervisor'
  | 'checklist'

/**
 * Одна запись реестра кодов решения — `DecisionCodeEntry` контракта.
 *
 * Поля `reason` здесь нет, и это не забытое поле: модуль вырезает его из ответа
 * двери, а схема закрыта (`additionalProperties: false`). `ru` — критерий книги
 * дословно, `en` — рабочий перевод, украинского текста у реестра нет.
 */
export interface CreditDecisionCodeEntry {
  id: string
  kind: CreditDecisionCodeKind
  /** Код книги (О-NN / У-NN) у `AB-O` / `AB-C`. */
  book: string | null
  /** Ближайший код книги у автогейта `AB-G`. */
  book_code: string | null
  category: CreditDecisionCodeCategory
  ru: string
  en: string
  /** Основание / примечание книги — подсказкой строки кода. */
  note_ru: string | null
  traits: CreditDecisionCodeTrait[]
  /** Служебный `RC-*`, который модуль проецирует на эту запись. */
  legacy_rc: string | null
}

/**
 * Ответ `listDecisionCodes`. `version` меняется при любой правке содержимого
 * реестра — поэтому она и есть тождество справочника для кэша фронта.
 */
export interface CreditDecisionCodesRegistry {
  version: string
  codes: CreditDecisionCodeEntry[]
}

/** Автора ручного решения модуль берёт из пропуска CRM; поле не шлётся (17-22). */
export interface ManualDecisionPayload {
  outcome: CreditDecisionOutcome
  rationale: string
  final_amount_minor?: number
  /** Только при `declined`: коды отказа реестра (`AB-O`/`AB-G`/`AB-X`) или служебные `RC-*`. */
  decline_codes?: string[]
  cooldown_until?: string
  /** Чек-лист (0.1.30/0.1.31, 19-5): только отвеченные пункты, в порядке листа, при любом исходе. */
  checklist?: Array<{ key: CreditChecklistKey; answer: CreditChecklistAnswer; note?: string }>
  /** Коды условия `AB-C-*` — только с `outcome: 'referred'`: это ПРЕДЛОЖЕНИЕ условного одобрения. */
  conditional_codes?: string[]
}

/**
 * Тело `confirmConditionalApproval` (0.1.30/0.1.31, 19-5). `confirmed_by` не шлётся:
 * подтверждающий — владелец пропуска CRM, как автор ручного решения (17-22).
 */
export interface CreditConditionalConfirmationPayload {
  proposal_decision_id: string
}

/**
 * Шапка рабочего места: счётчики и ЭФФЕКТИВНЫЕ права предъявленного пропуска.
 *
 * Тип объявляет то, что фронт ЧИТАЕТ, а не всё, что шлёт модуль: `user_id` и
 * `switches` контракт отдаёт, но здесь их намеренно нет — переключатели берутся
 * отдельной ручкой `GET /admin/switches`. Не «дополнять» тип по контракту.
 */
export interface CreditOverview {
  /**
   * Локализованное имя роли CRM как есть. `null` — роли в пропуске нет;
   * умолчания у модуля нет намеренно (контракт 0.1.26, `OperatorOverview.role`:
   * `type: [string, 'null']`). Поле НЕ основание что-либо прятать на экране.
   */
  role: string | null
  permissions: string[]
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
  /** Роль оператора из его пропуска CRM; идентификатор появится с WS-20. */
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
