/**
 * Связь заявки с клиентом CRM: «не искали» ≠ «не нашли».
 *
 * Требование владельца модуля, и оно про тот же класс дефекта, который мы
 * вычищали весь день: состояние, которое молчит вместо того, чтобы назвать
 * себя. Если недоступность CRM или отсутствие телефона показать как «в CRM
 * не найдено», то через неделю кто-нибудь сделает вывод, что этих людей в
 * CRM нет, — а их просто не искали.
 */
import { describe, it, expect } from 'vitest'
import { creditClientLinkState } from '../clientLink'

const base = {
  clientId: null,
  phone: '+380671234567',
  isLoading: false,
  error: null,
  matches: undefined,
}

describe('creditClientLinkState', () => {
  it('модуль назвал клиента — не ищем вовсе', () => {
    // Даже если поиск успел что-то вернуть: `client_id` от модуля старше
    // любой нашей догадки по телефону.
    expect(
      creditClientLinkState({
        ...base,
        clientId: 42,
        matches: [{ id: 7, first_name: 'A', last_name: 'B' }],
      })
    ).toEqual({ kind: 'linked', clientId: 42 })
  })

  it('нет телефона — «не искали», а не «не найдено»', () => {
    expect(creditClientLinkState({ ...base, phone: null })).toEqual({
      kind: 'not_searched',
      reason: 'no_phone',
    })
  })

  it('CRM не ответила — «не искали»: это поломка связи, а не факт о человеке', () => {
    expect(creditClientLinkState({ ...base, error: new Error('502') })).toEqual({
      kind: 'not_searched',
      reason: 'failed',
    })
  })

  it('ответа ещё нет — «не искали», а не пустой результат', () => {
    expect(creditClientLinkState({ ...base, isLoading: true })).toEqual({
      kind: 'not_searched',
      reason: 'loading',
    })
    // Запрос завершился, но данных нет — тоже не повод объявлять «не найдено».
    expect(creditClientLinkState({ ...base, matches: undefined })).toEqual({
      kind: 'not_searched',
      reason: 'loading',
    })
  })

  it('нет телефона важнее «загрузки»: иначе ожидание будет вечным', () => {
    // Без телефона поиск не запускается, и `isLoading` останется ложным
    // навсегда. Показать «шукаємо» значило бы обещать ответ, которого не будет.
    expect(creditClientLinkState({ ...base, phone: '', isLoading: true })).toEqual({
      kind: 'not_searched',
      reason: 'no_phone',
    })
  })

  it('искали и не нашли — это ФАКТ, и он называется', () => {
    expect(creditClientLinkState({ ...base, matches: [] })).toEqual({ kind: 'not_found' })
  })

  it('нашли одного — связываем', () => {
    expect(
      creditClientLinkState({
        ...base,
        matches: [{ id: 7, first_name: 'Іван', last_name: 'Петренко' }],
      })
    ).toEqual({ kind: 'found', clientId: 7, name: 'Петренко Іван' })
  })

  it('нашли нескольких — выбирает человек, а не мы', () => {
    // Молча взять первого значило бы связать заявку с чужой карточкой —
    // ошибка, которую потом никто не найдёт.
    expect(
      creditClientLinkState({
        ...base,
        matches: [
          { id: 7, first_name: 'Іван', last_name: 'Петренко' },
          { id: 9, first_name: 'Іван', last_name: 'Петренко' },
        ],
      })
    ).toEqual({ kind: 'ambiguous', count: 2 })
  })
})
