/**
 * Where the stand keeps Canadian projects switched off, auth-service refuses a
 * project in CAD or in CA with 422 PROJECT_CANADA_DISABLED. Its English detail
 * names an environment variable and board cards, which says nothing to an
 * administrator, so the code has its own sentence in all three languages.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import enErrors from '@/../public/locales/en/errors.json'
import esErrors from '@/../public/locales/es/errors.json'
import ukErrors from '@/../public/locales/uk/errors.json'
import { getErrorMessage } from '@/lib/errors'

// Copied from the api registry `shared/utils/error_codes.py`, not from the dictionaries.
const CODES = ['PROJECT_CANADA_DISABLED'] as const

type Codes = { codes: Record<string, string> }

const LANGUAGES: Array<[string, Codes]> = [
  ['uk', ukErrors as Codes],
  ['en', enErrors as Codes],
  ['es', esErrors as Codes],
]

describe('Canadian project refusal code', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists the one code of the api registry', () => {
    // Guards the checks below against an empty list.
    expect(CODES).toEqual(['PROJECT_CANADA_DISABLED'])
  })

  it.each(LANGUAGES)('has a sentence in %s', (_language, errors) => {
    const missing = CODES.filter((code) => {
      const text = errors.codes[code]
      return typeof text !== 'string' || text.trim() === ''
    })

    expect(missing).toEqual([])
  })

  it('carries no placeholders, no code name and nothing about the stand', () => {
    for (const [language, errors] of LANGUAGES) {
      for (const code of CODES) {
        const text = errors.codes[code]
        const where = `${language} ${code}`
        expect(typeof text === 'string' && text.trim() !== '', `${where}: no sentence`).toBe(true)
        expect(text, `${where}: a placeholder the server does not send`).not.toContain('{{')
        expect(text.toLowerCase(), `${where}: repeats the code name`).not.toContain(
          code.toLowerCase()
        )
        expect(text, `${where}: names the environment switch`).not.toContain(
          'PROJECT_CANADA_ENABLED'
        )
        expect(text, `${where}: names a board card`).not.toContain('#149')
      }
    }
  })

  it('reaches the administrator in Ukrainian through getErrorMessage with the params the server sends', () => {
    const code = 'PROJECT_CANADA_DISABLED'
    vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
      options?.ns === 'errors' && key === `codes.${code}`
        ? (ukErrors as Codes).codes[code]
        : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18n.t)
    const error = Object.assign(new Error('Request failed with status code 422'), {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          detail:
            'Projects in Canadian dollars or in Canada are switched off on this stand: ' +
            'PROJECT_CANADA_ENABLED is false until Tasks/CRMTasksBoard#1491-#1495 (client ' +
            'documents, report exports, CA tax ids and phones, CSV import) have landed. ' +
            'Refused: currency, country.',
          code,
          params: { fields: ['currency', 'country'], flag: 'PROJECT_CANADA_ENABLED' },
        },
      },
    })

    expect(getErrorMessage(error)).toBe((ukErrors as Codes).codes[code])
  })
})
