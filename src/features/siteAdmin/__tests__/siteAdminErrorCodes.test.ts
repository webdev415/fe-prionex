/**
 * Каждый код отказа ручек админки сайта (17-40a, реестр
 * `shared/utils/error_codes.py`: «a code added here needs a translation there
 * too») переведён на все три языка (17-40b, r2). Без перевода
 * `translateErrorCode` отдаёт slug сервера, и украинский администратор читает
 * `site_owner_not_set`.
 *
 * Список кодов — тот же, по которому `siteAdminErrorKind` узнаёт отказы:
 * добавленный там код без перевода здесь покраснеет.
 *
 * r3: реестр 17-40a r2 держит ПЯТЬ кодов `SITE_*` — добавился
 * `SITE_OWNER_CHANGE_DENIED` (403 на смене владельца). Стража между
 * репозиториями нет, поэтому ожидаемый набор в первой проверке — выписка из
 * реестра a (`shared/utils/error_codes.py`, блок `SITE_*`), а не копия
 * `SITE_ADMIN_ERROR_CODES`. Код, появившийся в реестре a, сам здесь не
 * покраснеет: выписку сверяет ревью обеих частей.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import enErrors from '@/../public/locales/en/errors.json'
import esErrors from '@/../public/locales/es/errors.json'
import ukErrors from '@/../public/locales/uk/errors.json'
import { getErrorMessage } from '@/lib/errors'
import { SITE_ADMIN_ERROR_CODES } from '../errors'

type Codes = { codes: Record<string, string> }

describe('коды отказов админки сайта', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('их ровно пять — столько, сколько кодов SITE_* в реестре 17-40a', () => {
    // Контроль от пустого множества: пустой список сделал бы тесты ниже
    // зелёными ни о чём. Набор — выписка реестра a (r2) в том же порядке.
    expect([...SITE_ADMIN_ERROR_CODES].sort()).toEqual([
      'SITE_ADMIN_ACCESS_DENIED',
      'SITE_ADMIN_NOT_CONFIGURED',
      'SITE_OWNER_CHANGE_DENIED',
      'SITE_OWNER_NOT_SET',
      'SITE_OWNER_PROJECT_NOT_FOUND',
    ])
  })

  it.each([
    ['uk', ukErrors as Codes],
    ['en', enErrors as Codes],
    ['es', esErrors as Codes],
  ])('у каждого есть фраза на %s', (_language, errors) => {
    const missing = SITE_ADMIN_ERROR_CODES.filter((code) => {
      const text = errors.codes[code]
      return typeof text !== 'string' || text.trim() === ''
    })

    expect(missing).toEqual([])
  })

  it('фразы без подстановок, которых сервер не шлёт, и не повторяют slug', () => {
    for (const errors of [ukErrors, enErrors, esErrors] as Codes[]) {
      for (const code of SITE_ADMIN_ERROR_CODES) {
        const text = errors.codes[code]
        expect(typeof text).toBe('string')
        expect(text).not.toContain('{{')
        expect(text.toLowerCase()).not.toContain(code.toLowerCase())
      }
    }
  })

  it.each([...SITE_ADMIN_ERROR_CODES])(
    '%s доходит до читателя по-украински через getErrorMessage',
    (code) => {
      vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
        options?.ns === 'errors' && key === `codes.${code}`
          ? (ukErrors as Codes).codes[code]
          : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18n.t)
      const error = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 409, data: { detail: code.toLowerCase(), code } },
      })

      expect(getErrorMessage(error)).toBe((ukErrors as Codes).codes[code])
    }
  )
})
