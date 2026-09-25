/**
 * Звонки и SMS CRM в карточке кредитной заявки — и почему их может не быть.
 *
 * ИСТОРИЯ БЕРЁТСЯ ТОЛЬКО ПО `client_id` ОТ МОДУЛЯ. Клиент, найденный по телефону
 * (`clientLink.ts`, состояние `found`), — наша догадка по совпадению номера,
 * а не связь: чаще всего это посторонний с тем же номером. Показать его
 * звонки как историю заявителя значило бы выдать чужие персональные данные за
 * факт о нашем клиенте.
 *
 * ПЯТЬ ОТВЕТОВ, А НЕ ДВА. «Звонков не найдено» — факт. «Нет права», «CRM не
 * ответила» и «модуль не связал заявку с клиентом» — не факты о звонках, и
 * пустой список на их месте читался бы как «клиенту не звонили». Права заранее
 * не проверяются: источник правды — сервер, и его `403` и есть ответ.
 */
import axios from 'axios'

export type CreditCrmChannelState<T> =
  /** Модуль не связал заявку с клиентом CRM — запроса не было. */
  | { kind: 'no_client' }
  | { kind: 'loading' }
  /** CRM ответила `403`: у оператора нет права на историю. */
  | { kind: 'forbidden' }
  /** Любой другой сбой (сеть, 5xx): истории нет, но это не «не найдено». */
  | { kind: 'failed' }
  /** Ответ получен; `total === 0` — действительно ничего не найдено. */
  | { kind: 'ok'; items: T[]; total: number }

export interface CreditCrmChannelInput<T> {
  /** `client_id` заявки от модуля; не число — связи нет. */
  clientId: number | null | undefined
  /** Запрос завершился ответом — состояние решает он, а не наличие списка. */
  isSuccess: boolean
  error: unknown
  items: T[] | undefined
  total: number | undefined
}

export function crmChannelState<T>(input: CreditCrmChannelInput<T>): CreditCrmChannelState<T> {
  if (typeof input.clientId !== 'number') return { kind: 'no_client' }
  if (input.error) {
    return axios.isAxiosError(input.error) && input.error.response?.status === 403
      ? { kind: 'forbidden' }
      : { kind: 'failed' }
  }
  if (!input.isSuccess) return { kind: 'loading' }
  // Ответ пришёл, а списка в нём нет: это не «не найдено» (факт) и не вечная
  // загрузка, а ответ, из которого историю не получить.
  if (!Array.isArray(input.items)) return { kind: 'failed' }
  return {
    kind: 'ok',
    items: input.items,
    total: typeof input.total === 'number' ? input.total : input.items.length,
  }
}

/** Длительность разговора `m:ss` из секунд; нет значения — «—». */
export function formatTalkDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '—'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}
