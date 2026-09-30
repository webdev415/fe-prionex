/**
 * Чек-лист проверки и условное одобрение ручного решения — чистые правила над
 * состоянием формы и снимком решения (контракт модуля 0.1.30/0.1.31, 19-5;
 * сверено с `main` модуля 0852c782 — `openapi.yaml` `ManualDecisionRequest`,
 * `Decision`). Без React, i18n и транспорта: производное от формы считается
 * здесь, а не `useMemo` со списком зависимостей.
 */
import { CREDIT_CHECKLIST_ANSWERS, CREDIT_CHECKLIST_KEYS, CREDIT_CONDITIONAL_STAGES } from './enums'
import type {
  CreditChecklistAnswer,
  CreditChecklistItem,
  CreditChecklistKey,
  CreditConditionalStage,
  CreditDecision,
  ManualDecisionPayload,
} from './types'

/** Предел примечания пункта — `DecisionChecklistItem.note.maxLength` контракта. */
export const CREDIT_CHECKLIST_NOTE_MAX = 500

export type CreditChecklistAnswers = Partial<Record<CreditChecklistKey, CreditChecklistAnswer>>
export type CreditChecklistNotes = Partial<Record<CreditChecklistKey, string>>

/**
 * Чек-лист для тела решения: только отвеченные пункты и в порядке листа, а не
 * кликов. Ни одного ответа — `undefined`, и ключа `checklist` в теле нет: модуль
 * не выдумывает неприсланные пункты, и форма их тоже не выдумывает. Примечание
 * уходит только у отвеченного пункта и только непустым после `trim()`.
 */
export function checklistPayload(
  answers: CreditChecklistAnswers,
  notes: CreditChecklistNotes
): ManualDecisionPayload['checklist'] {
  const items: NonNullable<ManualDecisionPayload['checklist']> = []
  for (const key of CREDIT_CHECKLIST_KEYS) {
    const answer = answers[key]
    if (!answer) continue
    const note = (notes[key] ?? '').trim()
    items.push(note ? { key, answer, note } : { key, answer })
  }
  return items.length ? items : undefined
}

/** Сколько пунктов отвечено — счёт «Відмічено N з 11». */
export function answeredCount(answers: CreditChecklistAnswers): number {
  return CREDIT_CHECKLIST_KEYS.filter((key) => answers[key] !== undefined).length
}

export interface CreditConditionalView {
  /** `null` — ступени нет или она незнакомая: бейджа нет, кнопки подтверждения тоже. */
  stage: CreditConditionalStage | null
  codes: string[]
  /** `null` — суммы в снимке нет или она не число: карточка печатает «—». */
  amountMinor: number | null
}

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  (values as readonly unknown[]).includes(value)

/**
 * Условие решения — из снимка (`input_snapshot.conditional`), а не по `kind`
 * справочника: у роли без права решать справочника нет, а условие она видеть
 * обязана. Ступень — поле модуля, снимок — запасом. Ключа нет или он не объект —
 * `null`.
 *
 * Снимок читается терпимо, как `readScorecard`: тип описывает обещание
 * контракта, а в `input_snapshot` лежит JSON модуля любой версии. Поле не той
 * формы даёт пустое значение, а не падение карточки.
 */
export function conditionalOf(decision: CreditDecision): CreditConditionalView | null {
  const conditional: unknown = decision.input_snapshot?.conditional
  if (!isObject(conditional)) return null
  const stage = decision.conditional_stage ?? conditional.stage
  const amount = conditional.amount_minor
  return {
    stage: isOneOf(CREDIT_CONDITIONAL_STAGES, stage) ? stage : null,
    codes: Array.isArray(conditional.codes)
      ? conditional.codes.filter((code): code is string => typeof code === 'string')
      : [],
    amountMinor: typeof amount === 'number' && Number.isFinite(amount) ? amount : null,
  }
}

/**
 * Ответы чек-листа из снимка — только записи правильной формы: объект со
 * строкой `key` и ответом из листа. Незнакомый `key` остаётся (показ подпишет
 * его как прислано), незнакомый ответ и не-объект — отбрасываются. Примечание не
 * строка — `null`. Порядок — ответа модуля.
 */
export function checklistItemsOf(decision: CreditDecision): CreditChecklistItem[] {
  const checklist: unknown = decision.input_snapshot?.checklist
  const items = isObject(checklist) ? checklist.items : undefined
  if (!Array.isArray(items)) return []
  return items.flatMap((item): CreditChecklistItem[] => {
    if (!isObject(item) || typeof item.key !== 'string') return []
    if (!isOneOf(CREDIT_CHECKLIST_ANSWERS, item.answer)) return []
    return [
      {
        key: item.key as CreditChecklistKey,
        answer: item.answer,
        note: typeof item.note === 'string' ? item.note : null,
      },
    ]
  })
}

/**
 * Решение для строки «Коди відмови»: `decision_codes` без кодов условия. Модуль
 * дописывает туда `AB-C-*` предложения и подтверждения, и строка отказа читала
 * бы условное одобрение отказом.
 */
export function withoutConditionalCodes(decision: CreditDecision): CreditDecision {
  const codes = conditionalOf(decision)?.codes ?? []
  if (!codes.length || !decision.decision_codes) return decision
  return {
    ...decision,
    decision_codes: decision.decision_codes.filter((code) => !codes.includes(code)),
  }
}
