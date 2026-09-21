/**
 * Авторизация исходящих запросов кредитного модуля.
 *
 * Повод — дефект #1213: интерцептор читал JWT из localStorage под ключом
 * `access_token`, которого в CRM не существует — приложение кладёт токен под
 * `prionex_token` (`src/lib/api.ts`). Заголовок `Authorization` не уходил
 * никогда, и запрос модуля упирался в 401 сразу за шлюзом.
 *
 * Тест держит ИСТОЧНИК токена, а не имя ключа: третий случай краснеет, если
 * модуль снова начнёт читать хранилище сам, мимо общего помощника CRM.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { setAccessToken } from '@/lib/api'
import { creditHttp } from '../creditApi'

/** Ключ, который модуль читал по ошибке; в CRM под ним ничего не лежит. */
const LEGACY_TOKEN_KEY = 'access_token'
/** Ключ самого приложения — см. `TOKEN_KEY` в `src/lib/api.ts`. */
const CRM_TOKEN_KEY = 'prionex_token'

/**
 * Прогоняет запрос через интерцепторы `creditHttp` и возвращает конфиг,
 * который ушёл бы в транспорт. Свой адаптер, а не мок модуля: проверяем то,
 * что реально соберёт axios, включая заголовки от интерцептора.
 */
async function sentConfig(): Promise<InternalAxiosRequestConfig> {
  const seen: { config?: InternalAxiosRequestConfig } = {}
  const adapter: AxiosAdapter = async (config) => {
    seen.config = config
    return { data: {}, status: 200, statusText: 'OK', headers: config.headers, config }
  }
  const previousAdapter = creditHttp.defaults.adapter
  creditHttp.defaults.adapter = adapter
  try {
    await creditHttp.get('/api/v1/credit/products')
  } finally {
    creditHttp.defaults.adapter = previousAdapter
  }
  if (!seen.config) throw new Error('адаптер не получил запрос')
  return seen.config
}

function resetAuthState(): void {
  window.localStorage.clear()
  window.sessionStorage.clear()
  // Гасим и копию токена в памяти `lib/api` — иначе соседний случай увидит
  // чужой токен и «пустое хранилище» перестанет быть пустым.
  setAccessToken(null)
}

describe('creditHttp — интерцептор авторизации', () => {
  beforeEach(resetAuthState)
  afterEach(resetAuthState)

  it('подставляет JWT CRM из хранилища приложения', async () => {
    window.localStorage.setItem(CRM_TOKEN_KEY, 'JWT-FROM-CRM')

    const config = await sentConfig()

    expect(config.headers.get('Authorization')).toBe('Bearer JWT-FROM-CRM')
    // Заголовок пропуска — теперь ЕДИНСТВЕННОЕ, чем модуль представляется.
    // Роль и служебный ключ из браузера убраны на этапе 2 (`creditApi.ts`),
    // права модуль берёт из проверенного пропуска CRM; правка #1213 не должна
    // вернуть их обратно. Канонический разбор этой двери — `credentials.test.ts`.
    expect(config.headers.get('X-Operator-Role')).toBeUndefined()
    expect(config.headers.get('X-Internal-Api-Key')).toBeUndefined()
  })

  it('без токена не ставит заголовок вовсе', async () => {
    const config = await sentConfig()

    expect(config.headers.get('Authorization')).toBeUndefined()
  })

  it('спрашивает токен у CRM, а не хранилище напрямую', async () => {
    // Живая сессия, у которой хранилище опустело мимо логаута (приватный
    // режим, чистка извне, другой origin): CRM помнит токен в памяти и отдаёт
    // его из `getAccessToken`. Случай краснеет от любого второго чтения
    // localStorage в модуле — даже если ключ в нём написан правильный.
    setAccessToken('JWT-IN-MEMORY')
    window.localStorage.clear()

    const config = await sentConfig()

    expect(config.headers.get('Authorization')).toBe('Bearer JWT-IN-MEMORY')
  })

  it('не читает ключ access_token, которого в CRM нет', async () => {
    window.localStorage.setItem(LEGACY_TOKEN_KEY, 'LEGACY-JWT')

    const config = await sentConfig()

    expect(config.headers.get('Authorization')).toBeUndefined()
  })
})
