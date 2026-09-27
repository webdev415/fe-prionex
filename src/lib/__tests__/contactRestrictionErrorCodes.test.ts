/**
 * Every refusal the contact-restriction doors of client-service answer with —
 * the client delete (409 while a restriction is in force), the lift and the
 * reinstate — has a sentence in all three languages. Without one,
 * `translateErrorCode` falls back to the server's English detail and a
 * Ukrainian operator reads English.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import enErrors from '@/../public/locales/en/errors.json'
import esErrors from '@/../public/locales/es/errors.json'
import ukErrors from '@/../public/locales/uk/errors.json'
import { getErrorMessage, localizeCodedDetail } from '@/lib/errors'

// Copied from the api registry `shared/utils/error_codes.py` (CLIENT_HAS_CONTACT_RESTRICTIONS
// and the three CONTACT_RESTRICTION_* codes), not from the dictionaries: a code missing
// there stays red here.
const CODES = [
  'CLIENT_HAS_CONTACT_RESTRICTIONS',
  'CONTACT_RESTRICTION_ALREADY_LIFTED',
  'CONTACT_RESTRICTION_ALREADY_REINSTATED',
  'CONTACT_RESTRICTION_NOT_LIFTED',
] as const

type Codes = { codes: Record<string, string> }

const LANGUAGES: Array<[string, Codes]> = [
  ['uk', ukErrors as Codes],
  ['en', enErrors as Codes],
  ['es', esErrors as Codes],
]

function speakUkrainian(code: string) {
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
    options?.ns === 'errors' && key === `codes.${code}`
      ? (ukErrors as Codes).codes[code]
      : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18n.t)
}

function httpError(status: number, data: Record<string, unknown>) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

describe('contact-restriction refusal codes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists the four codes of the api registry', () => {
    // Guards the checks below against an empty list.
    expect(CODES).toHaveLength(4)
    expect(new Set(CODES).size).toBe(4)
  })

  it.each(LANGUAGES)('have a sentence in %s', (_language, errors) => {
    const missing = CODES.filter((code) => {
      const text = errors.codes[code]
      return typeof text !== 'string' || text.trim() === ''
    })

    expect(missing).toEqual([])
  })

  it('carry no placeholders, no code names and nothing about the stand', () => {
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

  it.each(CODES)('%s reaches the reader in Ukrainian through getErrorMessage', (code) => {
    speakUkrainian(code)
    const error = httpError(409, { detail: 'English server text', code })

    expect(getErrorMessage(error)).toBe((ukErrors as Codes).codes[code])
  })

  it('CLIENT_HAS_CONTACT_RESTRICTIONS reaches the delete dialog in Ukrainian through the rewritten detail', () => {
    const code = 'CLIENT_HAS_CONTACT_RESTRICTIONS'
    const serverText =
      'This client has contact restrictions in force and cannot be deleted: deleting it would ' +
      'drop them and reopen its addresses to messaging. Lift them first'
    speakUkrainian(code)
    const error = httpError(409, { detail: serverText, code })

    localizeCodedDetail(error)

    const data = error.response.data as { detail: string }
    expect(data.detail).toBe((ukErrors as Codes).codes[code])
    expect(data.detail).not.toBe(serverText)
  })
})
