/**
 * Чек-лист проверки и условное одобрение ручного решения — чистые правила над
 * состоянием формы и снимком решения (контракт модуля 0.1.30/0.1.31, 19-5;
 * сверено с `main` модуля 0852c782 — `openapi.yaml` `ManualDecisionRequest`,
 * `Decision`). Без React, i18n и транспорта: производное от формы считается
 * здесь, а не `useMemo` со списком зависимостей.
 */
import { CREDIT_CHECKLIST_KEYS } from './enums'
import type {
  CreditChecklistAnswer,
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
  stage: CreditConditionalStage
  codes: string[]
  amountMinor: number
}

/**
 * Условие решения — из снимка (`input_snapshot.conditional`), а не по `kind`
 * справочника: у роли без права решать справочника нет, а условие она видеть
 * обязана. Ступень — поле модуля, снимок — запасом. Ключа нет — `null`.
 */
export function conditionalOf(decision: CreditDecision): CreditConditionalView | null {
  const conditional = decision.input_snapshot?.conditional
  if (!conditional) return null
  return {
    stage: decision.conditional_stage ?? conditional.stage,
    codes: conditional.codes,
    amountMinor: conditional.amount_minor,
  }
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
