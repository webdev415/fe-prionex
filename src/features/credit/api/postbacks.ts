/**
 * Постбеки партнерам (18-13d): транспорт и перечни экрана правил.
 *
 * Двери — модуля (18-13b, контракт 0.1.46): правила и лог под группой шлюза `admin`,
 * права `credit.partner_postbacks.read|write`. Транспорт общий с разделом: тот же
 * `creditHttp` (пропуск оператора), тот же префикс и тот же разбор Problem — по
 * ссылке, а не копией (Р-18-13d-5): копия разошлась бы с оригиналом при первой
 * правке. Бизнес-правил правила здесь нет — их держит домен модуля.
 *
 * Перечни — снимок контракта (`credit-postback-contract.json`, страж
 * `creditPostbackContract.test.ts`). Значения ответа — открытые строки: код вне
 * перечня экран показывает как есть с пометкой, а не падает.
 */
import { CREDIT_PREFIX, creditHttp, toCreditError } from './creditApi'
import { CREDIT_POSTBACK_OUTCOMES, CREDIT_POSTBACK_TRIGGERS } from './postbackEnums'

/** Правило постбека — форма `PartnerPostbackRule`. */
export interface CreditPostbackRule {
  id: string
  name: string
  active: boolean
  /** Код триггера; перечень расширяемый. */
  trigger: string
  utm_source: string
  /** Адрес партнёра с макросами; часто несёт его токен — только под замазкой записи. */
  url_template: string
  goal: string | null
  currency: string | null
  created_at: string
  updated_at: string
  created_by: number
  updated_by: number
}

/** Ответ списка: живые правила проекта и перечни для экрана (`PartnerPostbackRuleList`). */
export interface CreditPostbackRuleList {
  items: CreditPostbackRule[]
  triggers: Array<{ code: string; amount_allowed: boolean }>
  macros: string[]
}

/** Частичная правка (`PartnerPostbackRulePatch`): присланные поля заменяют прежние. */
export type CreditPostbackRulePatch = Partial<
  Pick<
    CreditPostbackRule,
    'name' | 'active' | 'trigger' | 'utm_source' | 'url_template' | 'goal' | 'currency'
  >
>

// Перечни живут в файле без импортов (`enums.ts` берёт их, не таща транспорт);
// здесь — реэкспорт для прежних импортёров.
export {
  CREDIT_POSTBACK_AMOUNT_TRIGGERS,
  CREDIT_POSTBACK_MACROS,
  CREDIT_POSTBACK_TRIGGERS,
  isKnownPostbackTrigger,
} from './postbackEnums'

/**
 * Строка лога (`PartnerPostbackDelivery`, 18-13d-b). Без ПД клиента; `url` несёт
 * `click_id` и токен партнёра — только под замазкой записи. Коды — открытые строки.
 */
export interface CreditPostbackDelivery {
  id: number
  rule_id: string
  /** Название правила — и у удалённого. */
  rule_name: string
  trigger: string
  /** UUID заявки (`new_lead`) или кредита (`new_loan`). */
  action_id: string
  action_number: string | null
  status: string
  skip_reason: string | null
  /** У пропуска — `null`. */
  url: string | null
  response_code: number | null
  attempts: number
  created_at: string
  sent_at: string | null
  next_attempt_at: string | null
  /** Выдача сторнирована после отправки; партнёру не сообщается. */
  reversed_at: string | null
  /** Код модуля, не текст партнёра. */
  last_error: string | null
}

export interface CreditPostbackDeliveryList {
  items: CreditPostbackDelivery[]
  /** `null` — конец списка; `total` дверь не отдаёт. */
  next_cursor: string | null
}

type DeliveryParam = 'rule_id' | 'status' | 'trigger' | 'action_id' | 'created_from' | 'created_to'
/** Фильтры лога — имена параметров двери; даты — сутки UTC (`YYYY-MM-DD`). */
export type CreditPostbackDeliveryFilters = Partial<Record<DeliveryParam, string>>
export type CreditPostbackDeliveryParams = CreditPostbackDeliveryFilters & {
  limit?: number
  cursor?: string
}

/** Размер страницы лога — умолчание двери. */
export const CREDIT_POSTBACK_LOG_PAGE_SIZE = 25

/** Поля фильтров лога — как в ссылке экрана (`pb_<поле>`). */
export const POSTBACK_LOG_FILTER_KEYS = [
  'rule',
  'outcome',
  'trigger',
  'action',
  'from',
  'to',
] as const
export type PostbackLogFilterValues = Record<(typeof POSTBACK_LOG_FILTER_KEYS)[number], string>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = /^\d{4}-\d{2}-\d{2}$/
const oneOf = (list: readonly string[], value: string) => (list.includes(value) ? value : undefined)

/**
 * Поля фильтров → параметры двери лога. Мусор из вручную правленой ссылки и
 * недописанный UUID в запрос не уходят (модуль ответил бы 422); перевёрнутый
 * период («з» позже «по») — тоже, целиком. Даты — сутки UTC, как считает дверь.
 */
export function postbackLogRequest(values: PostbackLogFilterValues) {
  const action = values.action.trim()
  const from = DAY.test(values.from) ? values.from : ''
  const to = DAY.test(values.to) ? values.to : ''
  const rangeInverted = Boolean(from && to && from > to)
  const filters: CreditPostbackDeliveryFilters = {
    rule_id: UUID.test(values.rule) ? values.rule : undefined,
    status: oneOf(CREDIT_POSTBACK_OUTCOMES, values.outcome),
    trigger: oneOf(CREDIT_POSTBACK_TRIGGERS, values.trigger),
    action_id: UUID.test(action) ? action : undefined,
    created_from: rangeInverted ? undefined : from || undefined,
    created_to: rangeInverted ? undefined : to || undefined,
  }
  return { filters, rangeInverted, actionInvalid: action !== '' && !UUID.test(action) }
}

/** Тело создания (`PartnerPostbackRuleCreate`). */
export type CreditPostbackRuleInput = Required<CreditPostbackRulePatch>

/** Отказ клиентской проверки адреса — коды те же, что `details.reason` модуля. */
export type PostbackUrlProblem =
  | { reason: 'url_click_id_required' }
  | { reason: 'url_macro_unknown'; macros: string[] }
  | { reason: 'url_macro_not_for_trigger' }

const MACRO = /\{([^{}]*)\}/g

/**
 * Зеркало трёх проверок модуля (Р-18-13d-6), чтобы не гонять запрос впустую.
 * Правда — у модуля: схема, хост, макрос вне query и прочее решает его 422.
 * Перечни — из ответа списка (`macros`, `triggers`), а не из своей копии.
 */
export function checkPostbackUrl(
  template: string,
  trigger: string,
  list: Pick<CreditPostbackRuleList, 'triggers' | 'macros'>
): PostbackUrlProblem[] {
  const problems: PostbackUrlProblem[] = []
  const unknown = [...template.matchAll(MACRO)]
    .filter((match) => !list.macros.includes(match[1]))
    .map((match) => match[0])
  const rest = template.replace(MACRO, '')
  if (unknown.length > 0 || rest.includes('{') || rest.includes('}')) {
    problems.push({ reason: 'url_macro_unknown', macros: unknown })
  }
  // Модуль ищет `{click_id}` в query-строке: после первого `?` и до `#`.
  const head = template.split('#')[0]
  const query = head.includes('?') ? head.slice(head.indexOf('?') + 1) : ''
  if (!query.includes('{click_id}')) problems.push({ reason: 'url_click_id_required' })
  const known = list.triggers.find((item) => item.code === trigger)
  if (template.includes('{amount}') && known && !known.amount_allowed) {
    problems.push({ reason: 'url_macro_not_for_trigger' })
  }
  return problems
}

const RULES = `${CREDIT_PREFIX}/admin/partner-postbacks/rules`
const DELIVERIES = `${CREDIT_PREFIX}/admin/partner-postbacks/deliveries`

async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await request()).data
  } catch (error) {
    throw toCreditError(error)
  }
}

/** Ключ задаёт вызывающий: он знает границу нажатия (см. `useCreditPostbacks.ts`). */
const withKey = (key: string) => ({ headers: { 'Idempotency-Key': key } })

export const creditPostbacksApi = {
  rules: () => call(() => creditHttp.get<CreditPostbackRuleList>(RULES)),
  createRule: (input: CreditPostbackRuleInput, key: string) =>
    call(() => creditHttp.post<CreditPostbackRule>(RULES, input, withKey(key))),
  updateRule: (id: string, patch: CreditPostbackRulePatch, key: string) =>
    call(() =>
      creditHttp.patch<CreditPostbackRule>(
        `${RULES}/${encodeURIComponent(id)}`,
        patch,
        withKey(key)
      )
    ),
  /** Мягкое удаление: записи лога правила остаются с его названием. */
  deleteRule: (id: string, key: string) =>
    call(() =>
      creditHttp.delete<CreditPostbackRule>(`${RULES}/${encodeURIComponent(id)}`, withKey(key))
    ),
  /** Лог отправок: страница по курсору, фильтры — серверные (Р-18-13d-10). */
  listDeliveries: (params: CreditPostbackDeliveryParams) =>
    call(() =>
      creditHttp.get<CreditPostbackDeliveryList>(DELIVERIES, {
        params,
        paramsSerializer: { indexes: null },
      })
    ),
}
