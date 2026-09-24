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
 * Три выхода ОДНОГО правила: что является предметом взыскания, что показывает
 * карта кредитного модуля и что уходит в список «Позики» на показ.
 *
 * Отдаются вместе намеренно. Две независимые выборки в разных местах экрана
 * однажды разойдутся, и тогда долг либо пропадёт с экрана целиком, либо
 * попадёт в списание, которым CRM не владеет.
 *
 * `collectionDebts` — предмет взыскания: списание, бюро, реструктуризация,
 * платёж, цепочки, SMS. Кредит модуля сюда не попадает НИКОГДА и ни при каком
 * состоянии стенда: им владеет модуль, а переменная сборки не решает, кому
 * принадлежит долг. Поэтому параметра `creditBlockEnabled` у правила больше
 * нет — с ним выключенный флаг возвращал кредит во все действия взыскания
 * разом. Флаг читают теперь только разворот строки и карта.
 *
 * `creditProjections` — строки модуля; их разворачивает карта класса А.
 *
 * 🔴 `displayDebts` — ПОЛНЫЙ список ДЛЯ ПОКАЗА, в порядке ответа client-service.
 * Единственный законный потребитель — список «Позики» (`LoansCardList`), и
 * читает его ровно один файл: `ClientDetailPage.tsx`, мемо `displayLoans`.
 * Любое действие, взявшее этот выход, получит долг, которым CRM не владеет;
 * страж P-24 (`clientCardCreditBlock.test.tsx`) запрещает такую передачу по
 * имени пропса. Конкатенация `collectionDebts.concat(creditProjections)`
 * запрещена: она молча переставляет строки у клиента, у которого есть и
 * купленный долг, и наш кредит.
 */
export function splitDebtsByOrigin(debts: DebtDetail[]): {
  collectionDebts: DebtDetail[]
  creditProjections: DebtDetail[]
  displayDebts: DebtDetail[]
} {
  const collectionDebts: DebtDetail[] = []
  const creditProjections: DebtDetail[] = []
  for (const debt of debts) {
    ;(isCreditProjection(debt) ? creditProjections : collectionDebts).push(debt)
  }
  // Тот же массив, а не копия: технически третий выход равен входу, и только
  // имя с запретом стража отличает «список для показа» от «сырого списка».
  // Копия не дала бы ничего, кроме иллюзии безопасности.
  return { collectionDebts, creditProjections, displayDebts: debts }
}
