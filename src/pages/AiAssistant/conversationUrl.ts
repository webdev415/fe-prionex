/**
 * Deep-link на конкретный диалог ассистента: /dashboard/ai-assistant?conversation=<id>.
 *
 * Работает поверх window.history НАМЕРЕННО, без useSearchParams:
 * страница не использует router-хуки, и все её тесты рендерят компонент без
 * Router-обёртки — завязка на контекст роутера сломала бы их и добавила бы
 * ререндер всей страницы на каждое изменение query. Меняется только query
 * string (pathname остаётся прежним, так что проверки
 * `location.pathname === '/dashboard/ai-assistant'` в DashboardLayout не
 * задеваются), а `history.state` передаётся как есть — внутренние ключи
 * React Router в нём переживают replaceState.
 */

export const CONVERSATION_QUERY_PARAM = 'conversation'

/**
 * Разбор параметра из строки query. Принимает только положительное целое
 * разумной длины — всё остальное (мусор, отрицательные, дробные, пустое)
 * трактуется как отсутствие deep-link, чтобы кривая ссылка вела себя как
 * обычное открытие страницы, а не как ошибка.
 */
export function parseConversationParam(search: string): number | null {
  const raw = new URLSearchParams(search).get(CONVERSATION_QUERY_PARAM)
  if (raw == null || !/^\d{1,12}$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * Отразить активный диалог в адресной строке (replaceState — история браузера
 * не засоряется записью на каждый диалог). `null` убирает параметр (новый чат,
 * умерший указатель). Остальные query-параметры не трогаются.
 */
export function writeConversationParam(id: number | null): void {
  const url = new URL(window.location.href)
  const current = url.searchParams.get(CONVERSATION_QUERY_PARAM)
  const next = id == null ? null : String(id)
  if (current === next) return
  if (next == null) {
    url.searchParams.delete(CONVERSATION_QUERY_PARAM)
  } else {
    url.searchParams.set(CONVERSATION_QUERY_PARAM, next)
  }
  window.history.replaceState(window.history.state, '', url)
}
