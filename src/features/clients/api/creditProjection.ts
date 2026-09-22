/**
 * Строка `debts`, которую в CRM записал кредитный модуль.
 *
 * Живёт рядом с типом `DebtDetail`, а не в карточке клиента, потому что один и
 * тот же список долгов читают несколько экранов, и каждому из них предстоит
 * отличать наш выданный кредит от купленного долга. Копия правила разошлась бы
 * на первом же новом значении `origin`, а разойтись ей нельзя: по этому
 * признаку строка исчезает из списка «Позики» и из всех действий взыскания.
 *
 * ⚠️ Умолчание названо явно, а не через `debt.origin === 'credit_module'`: на
 * client-service до ревизии 176 поля нет вовсе, и молчаливое `undefined` в
 * сравнении дало бы верный ответ по случайности, а не по правилу.
 */
import type { DebtDetail } from './types'

/** Значение `origin`, которым client-service помечает долг без источника. */
export const DEBT_ORIGIN_FACTORING = 'factoring'

/** Значение `origin` у строки, созданной кредитным модулем. */
export const DEBT_ORIGIN_CREDIT_MODULE = 'credit_module'

export function isCreditProjection(debt: DebtDetail): boolean {
  return (debt.origin ?? DEBT_ORIGIN_FACTORING) === DEBT_ORIGIN_CREDIT_MODULE
}

/**
 * Разделение одного списка на два: что остаётся предметом взыскания и что
 * показывает блок «Кредит (наш)».
 *
 * Отдаётся парой намеренно. Это ОДНО правило с двумя выходами: строка уходит
 * из действий взыскания ровно тогда, когда её показывает блок. Две независимые
 * выборки в разных местах экрана однажды разойдутся, и тогда долг либо
 * пропадёт с экрана целиком, либо попадёт в списание, которым CRM не владеет.
 *
 * При выключенном блоке разделения нет вовсе: список остаётся полным, потому
 * что показать строку больше негде.
 */
export function splitDebtsByOrigin(
  debts: DebtDetail[],
  creditBlockEnabled: boolean
): { collectionDebts: DebtDetail[]; creditProjections: DebtDetail[] } {
  if (!creditBlockEnabled) return { collectionDebts: debts, creditProjections: [] }
  const collectionDebts: DebtDetail[] = []
  const creditProjections: DebtDetail[] = []
  for (const debt of debts) {
    ;(isCreditProjection(debt) ? creditProjections : collectionDebts).push(debt)
  }
  return { collectionDebts, creditProjections }
}
