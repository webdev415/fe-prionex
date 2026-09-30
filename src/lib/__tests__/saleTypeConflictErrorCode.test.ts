/**
 * The upload answers 409 SALE_TYPE_CONFLICT when the seller already has an
 * agreement with the number of a new sale under another type (KAN-1617). The
 * wizard names the type on step 1 from `params`; the toast `useUploadImport`
 * raises reads this code's sentence, which therefore takes no values.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import enErrors from '@/../public/locales/en/errors.json'
import esErrors from '@/../public/locales/es/errors.json'
import ukErrors from '@/../public/locales/uk/errors.json'
import { getErrorMessage } from '@/lib/errors'

// Copied from the api registry `shared/utils/error_codes.py`, not from the dictionaries.
const CODES = ['SALE_TYPE_CONFLICT'] as const

type Codes = { codes: Record<string, string> }

const LANGUAGES: Array<[string, Codes]> = [
  ['uk', ukErrors as Codes],
  ['en', enErrors as Codes],
  ['es', esErrors as Codes],
]

describe('sale type conflict refusal code', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists the one code of the api registry', () => {
    // Guards the checks below against an empty list.
    expect(CODES).toEqual(['SALE_TYPE_CONFLICT'])
  })

  it.each(LANGUAGES)('has a sentence in %s', (_language, errors) => {
    const missing = CODES.filter((code) => {
      const text = errors.codes[code]
      return typeof text !== 'string' || text.trim() === ''
    })

    expect(missing).toEqual([])
  })

  it('carries no placeholders and no code name', () => {
    for (const [language, errors] of LANGUAGES) {
      for (const code of CODES) {
        const text = errors.codes[code]
        const where = `${language} ${code}`
        expect(typeof text === 'string' && text.trim() !== '', `${where}: no sentence`).toBe(true)
        expect(text, `${where}: a placeholder the toast does not fill`).not.toContain('{{')
        expect(text.toLowerCase(), `${where}: repeats the code name`).not.toContain(
          code.toLowerCase()
        )
      }
    }
  })

  it('reaches the operator in Ukrainian through getErrorMessage with the params the server sends', () => {
    const code = 'SALE_TYPE_CONFLICT'
    vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
      options?.ns === 'errors' && key === `codes.${code}`
        ? (ukErrors as Codes).codes[code]
        : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18n.t)
    const error = Object.assign(new Error('Request failed with status code 409'), {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          detail:
            "Agreement '30-09-26ФБ' already exists for this seller with sale_type 'factoring'",
          code,
          params: { existing_sale_type: 'factoring' },
        },
      },
    })

    expect(getErrorMessage(error)).toBe((ukErrors as Codes).codes[code])
  })
})
