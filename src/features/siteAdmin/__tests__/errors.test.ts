/**
 * Отказ ручек админки сайта → слово для человека (17-40b).
 *
 * 409 однозначен по статусу (403 — с r3 уже нет, см. ниже). 503 — нет: его же
 * отдаёт шлюз, когда auth-service лежит, поэтому «не настроено» — только при
 * коде `SITE_ADMIN_NOT_CONFIGURED`.
 *
 * r2: признак — ВЕРХНИЙ `code`, как его шлёт 17-40a
 * (`{"detail": "<slug>", "code": "<UPPER>"}`). Тела ниже — ровно эта форма,
 * и главная сцена прогоняет её через `localizeCodedDetail` перехватчика при
 * ЗАДАННОМ переводе: тогда `detail` — уже человеческий текст, и распознать
 * «не настроено» по нему нельзя. Именно так r1 сломался бы молча.
 *
 * r3: у 403 два смысла — отказ выдачи ключа (`SITE_ADMIN_ACCESS_DENIED`) и
 * отказ смены владельца по правилу PUT 17-40a r2 (`SITE_OWNER_CHANGE_DENIED`).
 * Второй обязан узнаваться по коду и после перевода, иначе экран скажет
 * «спробуйте ще раз» там, где повтор ничего не даст.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'
import i18n from '@/lib/i18n'
import { localizeCodedDetail } from '@/lib/errors'
import ukErrors from '@/../public/locales/uk/errors.json'
import { siteAdminErrorKind } from '../errors'
import type { SiteAdminErrorKind } from '../types'

function httpError(status: number, data: unknown = {}): AxiosError {
  return new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: {},
    config: {},
  } as AxiosResponse)
}

/** Тела отказов 17-40a дословно (`routers/site_admin.py`). */
const BODY = {
  notConfigured: { detail: 'site_admin_not_configured', code: 'SITE_ADMIN_NOT_CONFIGURED' },
  ownerNotSet: { detail: 'site_owner_not_set', code: 'SITE_OWNER_NOT_SET' },
  accessDenied: { detail: 'site_admin_access_denied', code: 'SITE_ADMIN_ACCESS_DENIED' },
  ownerChangeDenied: { detail: 'site_owner_change_denied', code: 'SITE_OWNER_CHANGE_DENIED' },
  projectNotFound: {
    detail: 'site_owner_project_not_found',
    code: 'SITE_OWNER_PROJECT_NOT_FOUND',
  },
} as const

type Codes = { codes: Record<string, string> }

const CASES: Array<[number, { detail: string; code: string }, SiteAdminErrorKind]> = [
  [503, BODY.notConfigured, 'not_configured'],
  [409, BODY.ownerNotSet, 'owner_not_set'],
  [403, BODY.accessDenied, 'forbidden'],
  [403, BODY.ownerChangeDenied, 'owner_change_denied'],
  [404, BODY.projectNotFound, 'owner_project_gone'],
]

/** i18n отвечает украинскими переводами кодов — как у живого интерфейса. */
function speakUkrainian() {
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) => {
    const code = key.startsWith('codes.') ? key.slice('codes.'.length) : ''
    const text = options?.ns === 'errors' ? (ukErrors as Codes).codes[code] : undefined
    return text ?? (options?.defaultValue as string) ?? key
  }) as unknown as typeof i18n.t)
}

describe('siteAdminErrorKind', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // `%j` — тело в имени: у двух 403 одинаковый статус, имена не должны совпасть.
  it.each(CASES)('%s %j в форме 17-40a — свой вид отказа', (status, body, kind) => {
    expect(siteAdminErrorKind(httpError(status, { ...body }))).toBe(kind)
  })

  it.each(CASES)(
    '%s %j после перехватчика с переводом кода — вид тот же, хотя detail уже не slug',
    (status, body, kind) => {
      speakUkrainian()
      const error = httpError(status, { ...body })
      localizeCodedDetail(error)
      const data = error.response?.data as { detail: string }

      // Контроль сцены: перевод действительно подменил slug в detail. Без
      // этого тест проверял бы форму r1, в которой slug ещё на месте.
      expect(data.detail).toBe((ukErrors as Codes).codes[body.code])
      expect(data.detail).not.toBe(body.detail)

      expect(siteAdminErrorKind(error)).toBe(kind)
    }
  )

  it('503 только с верхним code (detail — чужой текст) — не настроено', () => {
    const error = httpError(503, { detail: 'any words', code: 'SITE_ADMIN_NOT_CONFIGURED' })
    expect(siteAdminErrorKind(error)).toBe('not_configured')
  })

  it.each([
    ['detail строкой', { detail: 'site_admin_not_configured' }],
    ['detail объектом', { detail: { code: 'site_admin_not_configured', message: 'x' } }],
  ])('503 со slug без code (%s) — запасной признак, не настроено', (_form, data) => {
    expect(siteAdminErrorKind(httpError(503, data))).toBe('not_configured')
  })

  it('503 без кода — недоступно, а не «не настроено»', () => {
    expect(siteAdminErrorKind(httpError(503, { message: 'upstream unavailable' }))).toBe(
      'unavailable'
    )
    expect(siteAdminErrorKind(httpError(503, 'Service Unavailable'))).toBe('unavailable')
  })

  it('503 с чужим кодом — недоступно', () => {
    expect(siteAdminErrorKind(httpError(503, { ...BODY.ownerNotSet }))).toBe('unavailable')
    expect(siteAdminErrorKind(httpError(503, { detail: 'site_owner_not_set' }))).toBe('unavailable')
  })

  it('403 со slug смены владельца без code — запасной признак, отказ смены', () => {
    expect(siteAdminErrorKind(httpError(403, { detail: 'site_owner_change_denied' }))).toBe(
      'owner_change_denied'
    )
  })

  it('403 без кода смены владельца — прежний «нет права», а не отказ смены', () => {
    // Декоратор `require_permission` отвечает 403 без кода; отказ выдачи ключа
    // несёт свой код. Ни тот, ни другой не про правило смены владельца.
    expect(siteAdminErrorKind(httpError(403, { detail: 'Permission denied' }))).toBe('forbidden')
    expect(siteAdminErrorKind(httpError(403, { ...BODY.accessDenied }))).toBe('forbidden')
  })

  it('404 без кода владельца — общий отказ, а не «проект удалён»', () => {
    expect(siteAdminErrorKind(httpError(404, { detail: 'Not Found' }))).toBe('failed')
  })

  it('429 без кода, с Retry-After (лимит выдачи ключей, a r4) — «слишком много попыток»', () => {
    const error = new AxiosError('request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 429,
      data: { detail: 'Too Many Requests' },
      statusText: '',
      headers: { 'retry-after': '60' },
      config: {},
    } as unknown as AxiosResponse)
    expect(siteAdminErrorKind(error)).toBe('too_many_requests')
  })

  it('401 — сессия CRM кончилась: повтор не поможет, нужен вход', () => {
    expect(siteAdminErrorKind(httpError(401, { detail: 'Not authenticated' }))).toBe(
      'session_expired'
    )
  })

  it('прочие статусы, сеть и не-axios ошибки — общий отказ', () => {
    expect(siteAdminErrorKind(httpError(500))).toBe('failed')
    expect(siteAdminErrorKind(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe('failed')
    expect(siteAdminErrorKind(new Error('boom'))).toBe('failed')
    expect(siteAdminErrorKind(undefined)).toBe('failed')
  })
})
