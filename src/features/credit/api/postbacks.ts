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

/** Триггеры контракта (`PartnerPostbackRule.trigger`). */
export const CREDIT_POSTBACK_TRIGGERS = ['new_lead', 'new_loan'] as const
/** Триггеры, допускающие `{amount}` (контракт: «`{amount}` — только у `new_loan`»). */
export const CREDIT_POSTBACK_AMOUNT_TRIGGERS = ['new_loan'] as const
/** Макросы адреса (`PartnerPostbackRuleList.macros`). */
export const CREDIT_POSTBACK_MACROS = [
  'click_id',
  'action_id',
  'goal',
  'amount',
  'currency',
] as const

/** Есть ли у кода подпись в словаре; нет — экран пишет код сырым с пометкой. */
export function isKnownPostbackTrigger(code: string): boolean {
  return (CREDIT_POSTBACK_TRIGGERS as readonly string[]).includes(code)
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
