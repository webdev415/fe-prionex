/**
 * Постбеки партнерам (18-13d): транспорт и перечни экрана правил.
 *
 * Двери — модуля (18-13b, контракт 0.1.44): правила под группой шлюза `admin`,
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
}
