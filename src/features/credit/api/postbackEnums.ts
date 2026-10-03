/**
 * Перечни постбеков партнерам (18-13d) — снимок контракта модуля
 * (`credit-postback-contract.json`, страж `creditPostbackContract.test.ts`).
 *
 * Отдельный файл БЕЗ импортов: `enums.ts` берёт отсюда пространства словаря и
 * не должен тянуть за собой транспорт (`postbacks.ts` → `creditApi.ts` → axios).
 */

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

/**
 * Уточнения отказа правила (`details.reason` 422, закрытый список модуля —
 * описание `createPartnerPostbackRule`). Текст экрана — по словарю
 * `credit.postbacks.form.errors.<код>`; код вне списка — текст Problem.
 */
export const CREDIT_POSTBACK_RULE_REASONS = [
  'url_too_long',
  'url_control_character',
  'url_unparseable',
  'url_scheme',
  'url_userinfo',
  'url_host_not_public',
  'url_macro_unknown',
  'url_macro_outside_query',
  'url_click_id_required',
  'url_macro_not_for_trigger',
  'goal_format',
  'currency_format',
] as const

/** Исходы строки лога (`PartnerPostbackDelivery.status`, 18-13d-b). */
export const CREDIT_POSTBACK_OUTCOMES = [
  'pending',
  'sent',
  'simulated',
  'failed',
  'skipped',
] as const
/** Причины пропуска (`PartnerPostbackDelivery.skip_reason`). */
export const CREDIT_POSTBACK_SKIP_REASONS = [
  'click_id_missing',
  'click_id_invalid',
  'loan_reversed',
] as const
/**
 * Коды `last_error` — enum у поля нет, модуль называет их в описании двери лога
 * (`listPartnerPostbackDeliveries`); текст ответа партнёра модуль не хранит.
 */
export const CREDIT_POSTBACK_LAST_ERRORS = [
  'redirect_not_followed',
  'http_4xx',
  'http_5xx',
  'network',
  'dns_unresolved',
  'private_address',
  'egress_denied',
  'invalid_url',
  'sender_error',
  'retries_exhausted',
] as const

/** Есть ли у кода подпись в словаре; нет — экран пишет код сырым с пометкой. */
export function isKnownPostbackTrigger(code: string): boolean {
  return (CREDIT_POSTBACK_TRIGGERS as readonly string[]).includes(code)
}

export function isKnownPostbackMacro(name: string): boolean {
  return (CREDIT_POSTBACK_MACROS as readonly string[]).includes(name)
}

export function isKnownPostbackRuleReason(code: string): boolean {
  return (CREDIT_POSTBACK_RULE_REASONS as readonly string[]).includes(code)
}
