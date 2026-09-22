/**
 * Два правила показа блока «Кредит (наш)», вынесенные из компонента.
 *
 * Оба — чистые функции и оба нужны тестам поимённо, а файл компонента экспорт
 * не-компонентов не терпит (правило `react-refresh/only-export-components`:
 * такой экспорт ломает горячую замену модуля).
 *
 * 1. ЧАСОВОЙ ПОЯС ЮРИСДИКЦИИ. День зачисления, закрытия и отказа — юридические
 *    факты календаря той страны, по чьему праву выдан кредит. Метка
 *    `2026-09-21T23:10:00Z` это 21 сентября в Лондоне и уже 22-е в Киеве;
 *    печатая её в зоне браузера, экран показал бы оператору день, о котором он
 *    будет спорить с клиентом.
 *
 * 2. ПЛАШКА СОСТОЯНИЯ. Четыре разных отказа требуют четырёх разных действий
 *    человека: истёк пропуск — перелогиниться, нет права — попросить его,
 *    404 — модуля на этом контуре нет, прочее — подождать и открыть вкладку
 *    снова. Один текст на всех сообщал бы оператору с протухшим пропуском, что
 *    кредитного модуля не существует.
 */

/** Юрисдикция контракта → зона IANA. */
export const JURISDICTION_TIME_ZONES: Record<string, string> = {
  UA: 'Europe/Kyiv',
  UK: 'Europe/London',
  'CA-AB': 'America/Edmonton',
}

/**
 * Умолчание — Киев: проекция `debts` юрисдикции не несёт вовсе, а клиенты CRM
 * украинские. Оно же страхует неизвестную юрисдикцию нового рынка: показать
 * день в зоне ближайшего контура честнее, чем в зоне случайного браузера.
 */
export const DEFAULT_TIME_ZONE = 'Europe/Kyiv'

export function jurisdictionTimeZone(jurisdiction?: string | null): string {
  if (!jurisdiction) return DEFAULT_TIME_ZONE
  return JURISDICTION_TIME_ZONES[jurisdiction] ?? DEFAULT_TIME_ZONE
}

/**
 * Ключ плашки по коду ответа двери.
 *
 * Тексты 401 и 403 переиспользуют словарь экрана раздела: там те же два
 * состояния уже названы словами, и второй набор формулировок про то же самое
 * разошёлся бы с первым.
 */
export function noticeKeyForStatus(status: number | undefined): string {
  if (status === 401) return 'credit.access.notAuthenticated'
  if (status === 403) return 'credit.access.noRights'
  if (status === 404) return 'credit.clientBlock.moduleUnavailable'
  return 'credit.clientBlock.temporaryFailure'
}
