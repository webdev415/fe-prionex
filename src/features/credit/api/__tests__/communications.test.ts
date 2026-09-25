/**
 * Состояние канала «звонки/SMS CRM» — пять ответов, а не «есть» и «пусто».
 *
 * «Нет права» и «CRM не ответила» обязаны отличаться от «не найдено»: пустой
 * список на их месте читался бы как «клиенту не звонили».
 */
import { describe, it, expect } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'
import { crmChannelState, formatTalkDuration } from '../communications'

const base = { clientId: 7, isSuccess: false, error: null, items: undefined, total: undefined }

const httpError = (status: number) =>
  new AxiosError('x', 'ERR_BAD_REQUEST', undefined, undefined, { status } as AxiosResponse)

describe('U-4: связи с клиентом CRM нет, запрос идёт', () => {
  it.each([null, undefined])('client_id %s — «модуль не пов’язав», а не пустота', (clientId) => {
    expect(crmChannelState({ ...base, clientId, error: httpError(403) })).toEqual({
      kind: 'no_client',
    })
  })

  it('запрос в пути — загрузка', () => {
    expect(crmChannelState({ ...base })).toEqual({ kind: 'loading' })
  })

  it('403 — нет права, а не «не найдено»', () => {
    expect(crmChannelState({ ...base, error: httpError(403) })).toEqual({ kind: 'forbidden' })
  })
})

describe('U-5: CRM не ответила', () => {
  it('500 — сбой, а не «нет права» и не «не найдено»', () => {
    expect(crmChannelState({ ...base, error: httpError(500) })).toEqual({ kind: 'failed' })
  })

  it('сеть без ответа — сбой', () => {
    expect(
      crmChannelState({ ...base, error: new AxiosError('Network Error', 'ERR_NETWORK') })
    ).toEqual({ kind: 'failed' })
  })

  it('не Axios-ошибка — тоже сбой', () => {
    expect(crmChannelState({ ...base, error: new Error('boom') })).toEqual({ kind: 'failed' })
  })
})

describe('U-6: ответ получен', () => {
  it('total: 0 — ответ «не знайдено», а не загрузка и не сбой', () => {
    expect(crmChannelState({ ...base, isSuccess: true, items: [], total: 0 })).toEqual({
      kind: 'ok',
      items: [],
      total: 0,
    })
  })

  it('строки и честное число', () => {
    expect(crmChannelState({ ...base, isSuccess: true, items: ['a', 'b'], total: 40 })).toEqual({
      kind: 'ok',
      items: ['a', 'b'],
      total: 40,
    })
  })

  it.each([
    [0, '0:00'],
    [65, '1:05'],
    [600, '10:00'],
    [null, '—'],
    [undefined, '—'],
  ] as const)('длительность %s → %s', (seconds, expected) => {
    expect(formatTalkDuration(seconds)).toBe(expected)
  })
})

describe('U-7: состояние решает статус запроса, а не наличие списка', () => {
  it('ответ пришёл без списка — сбой, никогда не вечная загрузка', () => {
    expect(crmChannelState({ ...base, isSuccess: true, items: undefined })).toEqual({
      kind: 'failed',
    })
  })

  it('ответ пришёл с пустым списком и без числа — «не знайдено» с нулём', () => {
    expect(crmChannelState({ ...base, isSuccess: true, items: [], total: undefined })).toEqual({
      kind: 'ok',
      items: [],
      total: 0,
    })
  })
})
