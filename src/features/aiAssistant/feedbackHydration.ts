import type {
  AssistantConversationDetail,
  AssistantFeedbackComprehension,
  AssistantFeedbackRating,
  AssistantFeedbackRequest,
  AssistantMessageFeedback,
} from './api'

/** Одна из двух независимых пар кнопок оценки. */
export type FeedbackField = 'rating' | 'comprehension'

/** Оценка ответа так, как её держит страница (выбранные кнопки блока). */
export interface MessageFeedbackState {
  rating?: AssistantFeedbackRating
  comprehension?: AssistantFeedbackComprehension
  /**
   * Поля, по которым сервер уже хранит оценку, но значение этой версии
   * страницы незнакомо (новая оценка на бэкенде раньше фронта, старая запись).
   * Кнопки такой пары не подсвечены, но ЗАБЛОКИРОВАНЫ: показать её свободной —
   * значит дать клику затереть сохранённое. В тело POST не уходит — по
   * контракту пропущенное поле сервер оставляет как есть.
   */
  unrecognised?: Partial<Record<FeedbackField, true>>
}

/** Список допустимых значений union-типа: каждый член — ключ, ни одного лишнего. */
type Known<T extends string> = Record<T, true>
type Comprehension = AssistantFeedbackComprehension

// Списки выведены из union-типов api.ts через `satisfies`: новое значение в
// union без строки здесь — ошибка компиляции, а не тихий отброс в рантайме.
const RATINGS = { useful: true, not_useful: true } satisfies Known<AssistantFeedbackRating>
const COMPREHENSIONS = { clear: true, unclear: true } satisfies Known<Comprehension>

function isRating(value: unknown): value is AssistantFeedbackRating {
  return typeof value === 'string' && Object.hasOwn(RATINGS, value)
}

function isComprehension(value: unknown): value is AssistantFeedbackComprehension {
  return typeof value === 'string' && Object.hasOwn(COMPREHENSIONS, value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Пара заблокирована: выбрана известная кнопка или сервер держит незнакомую. */
export function isFeedbackFieldLocked(state: MessageFeedbackState, field: FeedbackField): boolean {
  return state[field] != null || state.unrecognised?.[field] === true
}

/**
 * Оценки из истории диалога: id сообщения → выбранные кнопки.
 *
 * Без этого после F5 кнопки 👍/👎 и «Зрозуміло/Незрозуміло» снова серые, хотя
 * оценка лежит в БД, — и повторный клик шёл на сервер как новая оценка.
 *
 * Контракт поля — {@link AssistantConversationMessage.feedback}. Разбор
 * терпимый: не-объект (массив, строка) — оценки нет, страница не падает;
 * присутствующее, но незнакомое значение — пара заблокирована (`unrecognised`),
 * а не показана свободной.
 */
export function feedbackFromConversation(
  detail: AssistantConversationDetail
): Record<number, MessageFeedbackState> {
  const result: Record<number, MessageFeedbackState> = {}
  for (const message of detail.messages) {
    const feedback: unknown = message.feedback
    if (message.role !== 'assistant' || !isPlainObject(feedback)) continue
    const state: MessageFeedbackState = {}
    const unrecognised: Partial<Record<FeedbackField, true>> = {}
    const { rating, comprehension } = feedback
    if (isRating(rating)) state.rating = rating
    else if (rating != null) unrecognised.rating = true
    if (isComprehension(comprehension)) state.comprehension = comprehension
    else if (comprehension != null) unrecognised.comprehension = true
    if (Object.keys(unrecognised).length > 0) state.unrecognised = unrecognised
    if (state.rating || state.comprehension || state.unrecognised) result[message.id] = state
  }
  return result
}

function mergeOne(server: MessageFeedbackState, local: MessageFeedbackState): MessageFeedbackState {
  const merged: MessageFeedbackState = {}
  const rating = local.rating ?? server.rating
  const comprehension = local.comprehension ?? server.comprehension
  if (rating) merged.rating = rating
  if (comprehension) merged.comprehension = comprehension
  const unrecognised: Partial<Record<FeedbackField, true>> = {}
  for (const field of ['rating', 'comprehension'] as const) {
    if (merged[field] == null && (server.unrecognised?.[field] || local.unrecognised?.[field])) {
      unrecognised[field] = true
    }
  }
  if (Object.keys(unrecognised).length > 0) merged.unrecognised = unrecognised
  return merged
}

/**
 * Слить оценки с сервера с локальными: локальный выбор (клик, который ещё
 * едет на сервер) важнее снимка истории, но пустая локальная запись серверную
 * не прячет — по полю, а не по сообщению целиком.
 */
export function mergeFeedback(
  server: Record<number, MessageFeedbackState>,
  local: Record<number, MessageFeedbackState>
): Record<number, MessageFeedbackState> {
  const merged: Record<number, MessageFeedbackState> = { ...local }
  for (const [key, fromServer] of Object.entries(server)) {
    const id = Number(key)
    merged[id] = mergeOne(fromServer, local[id] ?? {})
  }
  return merged
}

/**
 * Тело POST /feedback из состояния кнопок: только известные значения.
 *
 * Контракт с бэкендом: пропущенное поле сервер оставляет как было, явный
 * `null` — стирает. Страница `null` не шлёт никогда, а незнакомое сохранённое
 * значение (`unrecognised`) просто не попадает в тело — и сервер его хранит.
 */
export function feedbackRequestBody(
  messageId: number,
  state: MessageFeedbackState
): AssistantFeedbackRequest {
  const body: AssistantFeedbackRequest = { message_id: messageId }
  if (state.rating) body.rating = state.rating
  if (state.comprehension) body.comprehension = state.comprehension
  return body
}

/**
 * Снимок диалога в кэше после успешного POST /feedback — с этой оценкой.
 *
 * Без этого возврат к диалогу в той же сессии гидратировал бы оценки из снимка,
 * снятого ДО клика (`staleTime` 30 с): кнопки снова серые, и следующий клик
 * ушёл бы как новая оценка. Поля — по контракту POST: пропущенное не трогаем.
 * Чужой диалог (сообщения нет) возвращается тем же объектом — без ререндера.
 */
export function withSavedFeedback(
  detail: AssistantConversationDetail | undefined,
  body: AssistantFeedbackRequest
): AssistantConversationDetail | undefined {
  if (!detail || !detail.messages.some((message) => message.id === body.message_id)) {
    return detail
  }
  return {
    ...detail,
    messages: detail.messages.map((message) => {
      if (message.id !== body.message_id) return message
      const feedback: AssistantMessageFeedback = isPlainObject(message.feedback)
        ? { ...message.feedback }
        : {}
      if (body.rating !== undefined) feedback.rating = body.rating
      if (body.comprehension !== undefined) feedback.comprehension = body.comprehension
      return { ...message, feedback }
    }),
  }
}
