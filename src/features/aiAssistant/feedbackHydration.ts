import type {
  AssistantConversationDetail,
  AssistantFeedbackComprehension,
  AssistantFeedbackRating,
} from './api'

/** Оценка ответа так, как её держит страница (выбранные кнопки блока). */
export interface MessageFeedbackState {
  rating?: AssistantFeedbackRating
  comprehension?: AssistantFeedbackComprehension
}

const RATINGS: readonly string[] = ['useful', 'not_useful']
const COMPREHENSIONS: readonly string[] = ['clear', 'unclear']

/**
 * Оценки из истории диалога: id сообщения → выбранные кнопки.
 *
 * Без этого после F5 кнопки 👍/👎 и «Зрозуміло/Незрозуміло» снова серые, хотя
 * оценка лежит в БД, — и повторный клик шёл на сервер как новая оценка.
 * Незнакомые значения отбрасываются (кнопки для них нет).
 */
export function feedbackFromConversation(
  detail: AssistantConversationDetail
): Record<number, MessageFeedbackState> {
  const result: Record<number, MessageFeedbackState> = {}
  for (const message of detail.messages) {
    if (message.role !== 'assistant' || !message.feedback) continue
    const { rating, comprehension } = message.feedback
    const state: MessageFeedbackState = {}
    if (rating && RATINGS.includes(rating)) state.rating = rating as AssistantFeedbackRating
    if (comprehension && COMPREHENSIONS.includes(comprehension)) {
      state.comprehension = comprehension as AssistantFeedbackComprehension
    }
    if (state.rating || state.comprehension) result[message.id] = state
  }
  return result
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
    const mine = local[id] ?? {}
    merged[id] = {
      rating: mine.rating ?? fromServer.rating,
      comprehension: mine.comprehension ?? fromServer.comprehension,
    }
  }
  return merged
}
