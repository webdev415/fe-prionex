/**
 * Связь кредитной заявки с клиентом CRM — и почему её обычно нет.
 *
 * ПОЧЕМУ ЭТО НЕ «ПРОСТО ССЫЛКА». `client_id` у заявок модуля пуст всегда, и
 * причина не в том, что этап не наступил: **CRM физически не может завести
 * канадского заёмщика**. При создании клиента налоговый номер обязателен и
 * обязан быть ровно десять цифр (`services/client/app/schemas/client.py:133`,
 * валидатор `^\d{10}$`, комментарий класса — «TIN-based brand isolation», то
 * есть это ключ опознания, а не поле анкеты). На боевой базе таких номеров
 * 381 840 против 299 прочих — формат не формальность.
 *
 * У канадца такого номера нет. Значит связать заявку можно ТОЛЬКО с тем, кто
 * в CRM уже есть, — с украинским должником из купленного портфеля. Ищем по
 * телефону под правами самого оператора (`searchClientsByPhoneExact`), а не
 * сервисным ключом: оператор увидит ровно тех, кого ему и так положено видеть.
 *
 * ТРИ СОСТОЯНИЯ, А НЕ ДВА. Требование владельца модуля, и оно верное:
 * «не искали» обязано отличаться от «искали и не нашли». Иначе через неделю
 * кто-нибудь решит, что этих людей в CRM нет, — а их просто не искали, потому
 * что телефона не было или CRM не ответила. Пустая ссылка читается как
 * поломка, «не найдено» — как факт, «не искали» — как незаданный вопрос.
 */

export type CreditClientLinkState =
  /** `client_id` пришёл от модуля — связь есть, гадать не о чем. */
  | { kind: 'linked'; clientId: number }
  /** Искали по телефону и нашли ровно одного. */
  | { kind: 'found'; clientId: number; name: string }
  /** Искали и нашли несколько — выбирать обязан человек, а не мы. */
  | { kind: 'ambiguous'; count: number }
  /** Искали и не нашли. Это ФАКТ, а не отсутствие ответа. */
  | { kind: 'not_found' }
  /** Не искали, и вот почему. Это НЕ «нет в CRM». */
  | { kind: 'not_searched'; reason: 'no_phone' | 'loading' | 'failed' }

export interface CreditClientLinkInput {
  /** `client_id` заявки или кредита; `null` — модуль клиента не создавал. */
  clientId: number | null | undefined
  /** Телефон заёмщика с заявки. Без него искать не по чему. */
  phone: string | null | undefined
  /** Идёт ли поиск прямо сейчас. */
  isLoading: boolean
  /** Ошибка поиска: CRM не ответила — это «не искали», а не «не нашли». */
  error: unknown
  /** Что вернул поиск; `undefined` — ответа ещё не было. */
  matches: Array<{ id: number; first_name: string; last_name: string }> | undefined
}

export function creditClientLinkState(input: CreditClientLinkInput): CreditClientLinkState {
  // Модуль сам сказал, кто это, — ничего не ищем.
  if (typeof input.clientId === 'number') return { kind: 'linked', clientId: input.clientId }

  // Порядок причин важен: «нет телефона» проверяем ПЕРВЫМ, потому что при
  // отсутствии телефона поиск не запускается вовсе, и `isLoading` будет
  // ложным — состояние «загрузка» тут означало бы вечное ожидание.
  if (!input.phone) return { kind: 'not_searched', reason: 'no_phone' }
  if (input.isLoading) return { kind: 'not_searched', reason: 'loading' }
  if (input.error) return { kind: 'not_searched', reason: 'failed' }
  if (!input.matches) return { kind: 'not_searched', reason: 'loading' }

  if (input.matches.length === 0) return { kind: 'not_found' }
  if (input.matches.length > 1) return { kind: 'ambiguous', count: input.matches.length }

  const only = input.matches[0]
  return {
    kind: 'found',
    clientId: only.id,
    name: `${only.last_name} ${only.first_name}`.trim(),
  }
}
