import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import { getErrorMessage, translateErrorCode } from '../errors'

function makeHttpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

const SPANISH: Record<string, string> = {
  'codes.LOAN_ALREADY_CLOSED': 'El crédito ya está cerrado',
  'codes.PAYMENT_AMOUNT_TOO_HIGH': 'El importe supera la deuda de {{debt}}',
  'http.notFound': 'Recurso no encontrado.',
}

function speakSpanish() {
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) => {
    const template = SPANISH[key]
    if (!template) return (options?.defaultValue as string) ?? key
    return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name]))
  }) as unknown as typeof i18n.t)
}

describe('error codes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('translates a coded detail', () => {
    speakSpanish()
    const error = makeHttpError(409, {
      detail: 'Loan is already closed',
      code: 'LOAN_ALREADY_CLOSED',
    })

    expect(getErrorMessage(error)).toBe('El crédito ya está cerrado')
  })

  it('fills the message with the values the server sends', () => {
    speakSpanish()
    const error = makeHttpError(400, {
      detail: 'Amount exceeds the debt of 500',
      code: 'PAYMENT_AMOUNT_TOO_HIGH',
      params: { debt: '500' },
    })

    expect(getErrorMessage(error)).toBe('El importe supera la deuda de 500')
  })

  it('keeps the server text when the code has no translation', () => {
    speakSpanish()
    const error = makeHttpError(400, { detail: 'Something specific', code: 'NOT_TRANSLATED_YET' })

    expect(getErrorMessage(error)).toBe('Something specific')
  })

  it('translates the code of the messaging envelope', () => {
    speakSpanish()
    const error = makeHttpError(409, {
      error: { code: 'LOAN_ALREADY_CLOSED', message: 'Loan is already closed' },
    })

    expect(getErrorMessage(error)).toBe('El crédito ya está cerrado')
  })

  it('translates the generic status fallback', () => {
    speakSpanish()

    expect(getErrorMessage(makeHttpError(404))).toBe('Recurso no encontrado.')
  })

  it('returns the fallback for a missing code', () => {
    expect(translateErrorCode(undefined, 'Plain text')).toBe('Plain text')
  })
})
