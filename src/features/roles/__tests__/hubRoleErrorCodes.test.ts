/**
 * Every refusal code the HUB chat-role backend (CRM-2) and the project scope
 * (CRM-1/CRM-3) can answer with has a sentence in all three languages
 * (KAN-1476). Without one, `translateErrorCode` falls back to the server's
 * English detail and a Ukrainian admin reads English.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import enErrors from '@/../public/locales/en/errors.json'
import esErrors from '@/../public/locales/es/errors.json'
import ukErrors from '@/../public/locales/uk/errors.json'
import { getErrorMessage } from '@/lib/errors'

const CODES = [
  'HUB_ROLE_DISABLED',
  'HUB_ROLE_UNKNOWN',
  'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
  'HUB_ADMIN_ALIAS_REQUIRES_HUB_ADMIN',
  'HUB_ADMIN_ASSIGNMENT_REQUIRES_HUB_ADMIN',
  'HUB_ROLE_DEFAULT_LOCKED',
  'HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING',
  'PROJECT_SCOPE_DENIED',
] as const

type Codes = { codes: Record<string, string> }

describe('HUB chat-role refusal codes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    ['uk', ukErrors as Codes],
    ['en', enErrors as Codes],
    ['es', esErrors as Codes],
  ])('have a sentence in %s', (_language, errors) => {
    const missing = CODES.filter((code) => {
      const text = errors.codes[code]
      return typeof text !== 'string' || text.trim() === ''
    })

    expect(missing).toEqual([])
  })

  it('carry no placeholders the backend does not send', () => {
    for (const errors of [ukErrors, enErrors, esErrors] as Codes[]) {
      for (const code of CODES) {
        const text = errors.codes[code]
        expect(typeof text).toBe('string')
        expect(text).not.toContain('{{')
      }
    }
  })

  it.each(CODES)('%s reaches the reader in Ukrainian through getErrorMessage', (code) => {
    vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
      options?.ns === 'errors' && key === `codes.${code}`
        ? (ukErrors as Codes).codes[code]
        : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18n.t)
    const error = Object.assign(new Error('Request failed with status code 403'), {
      isAxiosError: true,
      response: { status: 403, data: { detail: 'English server text', code } },
    })

    expect(getErrorMessage(error)).toBe((ukErrors as Codes).codes[code])
  })
})
