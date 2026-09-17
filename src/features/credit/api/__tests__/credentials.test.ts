/**
 * Служебного ключа в браузере больше нет — и это проверяется, а не заявляется.
 *
 * До перехода на пропуск раздел работал так: оператор вписывал общий ключ
 * модуля, тот ложился в `sessionStorage`, и каждый запрос уносил его вместе
 * с заголовком `X-Operator-Role`, который человек выбирал сам. Кто знал ключ
 * — назначал себе любую роль поверх настоящих прав.
 *
 * Здесь два разных утверждения, и оба нужны:
 *  1) браузер БОЛЬШЕ НЕ ОТПРАВЛЯЕТ ключ и роль;
 *  2) ключ, уже лежащий в хранилище с прежних сессий, СТИРАЕТСЯ.
 * Первое без второго оставляет секрет на общей машине кол-центра.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

const STORED_KEY = 'credit.stand.apiKey'
const STORED_ROLE = 'credit.stand.role'
/**
 * Ключ, под которым CRM держит пропуск оператора, — `TOKEN_KEY` в
 * `src/lib/api.ts`. Раньше здесь стояло `access_token`: это имя поля в ТЕЛЕ
 * ответа логина, а не ключ хранилища, и под ним в браузере не лежит ничего.
 * «Запрос уносит пропуск» проверялось, стало быть, на токене, которого в CRM
 * не бывает (#1213). Модуль спрашивает токен у `getAccessToken()` — тест сеет
 * его туда же, откуда помощник его берёт.
 */
const CRM_TOKEN_KEY = 'prionex_token'

/**
 * Прогоняет config через request-интерцептор модуля, как это делает axios.
 *
 * Модуль импортируется ОТДЕЛЬНО и заранее (`loadModule`), а секреты сеются
 * ПОСЛЕ него — иначе уборка при импорте вычистит хранилище раньше, чем до
 * него доберётся интерцептор, и тест перестанет ловить возврат заголовка:
 * читать было бы уже нечего. Здесь проверяется именно «ключ лежит рядом, а
 * запрос его не уносит».
 */
async function loadModule() {
  return import('../creditApi')
}

function runInterceptor(creditHttp: Awaited<ReturnType<typeof loadModule>>['creditHttp']) {
  const handlers = (
    creditHttp.interceptors.request as unknown as {
      handlers: Array<{
        fulfilled: (c: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
      } | null>
    }
  ).handlers.filter(Boolean)
  expect(handlers.length).toBeGreaterThan(0)
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig
  return handlers.reduce((acc, h) => h!.fulfilled(acc), config)
}

describe('учётные данные кредитного модуля в браузере', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('запрос уносит пропуск оператора и ничего кроме него', async () => {
    const { creditHttp } = await loadModule()
    window.localStorage.setItem(CRM_TOKEN_KEY, 'pass-token')
    // Секреты прежней схемы лежат в хранилище — но уйти не должны.
    window.sessionStorage.setItem(STORED_KEY, 'dev-portal-key')
    window.localStorage.setItem(STORED_ROLE, 'risk_manager')

    const config = runInterceptor(creditHttp)

    expect(config.headers.get('Authorization')).toBe('Bearer pass-token')
    expect(config.headers.get('X-Internal-Api-Key')).toBeFalsy()
    expect(config.headers.get('X-Operator-Role')).toBeFalsy()
    // Ни один заголовок не должен нести значение ключа под другим именем.
    expect(JSON.stringify(config.headers.toJSON())).not.toContain('dev-portal-key')
  })

  it('стирает ключ и роль, оставшиеся в браузере с прежних сессий', async () => {
    window.sessionStorage.setItem(STORED_KEY, 'dev-portal-key')
    window.localStorage.setItem(STORED_KEY, 'dev-portal-key')
    window.localStorage.setItem(STORED_ROLE, 'risk_manager')
    window.localStorage.setItem(CRM_TOKEN_KEY, 'pass-token')

    await import('../creditApi')

    expect(window.sessionStorage.getItem(STORED_KEY)).toBeNull()
    expect(window.localStorage.getItem(STORED_KEY)).toBeNull()
    expect(window.localStorage.getItem(STORED_ROLE)).toBeNull()
    // Уборка прицельная: пропуск оператора она трогать не должна.
    expect(window.localStorage.getItem(CRM_TOKEN_KEY)).toBe('pass-token')
  })
})
