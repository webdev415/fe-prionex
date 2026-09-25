import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import enErrors from '@/../public/locales/en/errors.json'
import esErrors from '@/../public/locales/es/errors.json'
import { getErrorMessage, localizeCodedDetail, translateErrorCode } from '../errors'

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
    const values = (options?.replace ?? {}) as Record<string, unknown>
    return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name]))
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

  it('never lets server values act as translation options', () => {
    speakSpanish()
    const params = { debt: '500', ns: 'other', defaultValue: 'X', returnObjects: true }
    const error = makeHttpError(400, {
      detail: 'Amount exceeds the debt of 500',
      code: 'PAYMENT_AMOUNT_TOO_HIGH',
      params,
    })

    expect(getErrorMessage(error)).toBe('El importe supera la deuda de 500')
    expect(i18n.t).toHaveBeenCalledWith('codes.PAYMENT_AMOUNT_TOO_HIGH', {
      ns: 'errors',
      defaultValue: '',
      replace: params,
    })
  })

  it('falls back to the server text when the translation is not a string', () => {
    vi.spyOn(i18n, 't').mockReturnValue({ nested: 'object' } as unknown as string)
    const error = makeHttpError(400, {
      detail: 'Amount exceeds the debt of 500',
      code: 'PAYMENT_AMOUNT_TOO_HIGH',
    })

    expect(getErrorMessage(error)).toBe('Amount exceeds the debt of 500')
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

  it('rewrites a coded detail for callers that read it directly', () => {
    speakSpanish()
    const error = makeHttpError(409, {
      detail: 'Loan is already closed',
      code: 'LOAN_ALREADY_CLOSED',
    })

    localizeCodedDetail(error)

    expect(error.response.data).toEqual({
      detail: 'El crédito ya está cerrado',
      code: 'LOAN_ALREADY_CLOSED',
    })
  })

  it('follows a language switch after the request failed', () => {
    speakSpanish()
    const error = makeHttpError(409, {
      detail: 'Loan is already closed',
      code: 'LOAN_ALREADY_CLOSED',
    })
    localizeCodedDetail(error)
    const data = error.response.data as { detail: string }
    expect(data.detail).toBe('El crédito ya está cerrado')

    vi.restoreAllMocks()
    vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) =>
      key === 'codes.LOAN_ALREADY_CLOSED'
        ? 'Кредит уже закрито'
        : ((options?.defaultValue as string) ?? key)) as unknown as typeof i18n.t)

    expect(data.detail).toBe('Кредит уже закрито')
  })

  it('keeps the server text when the code has no translation', () => {
    speakSpanish()
    const error = makeHttpError(409, {
      detail: 'Letter already confirmed',
      code: 'letter_already_confirmed',
    })

    localizeCodedDetail(error)

    expect((error.response.data as { detail: string }).detail).toBe('Letter already confirmed')
  })

  it('leaves an uncoded detail alone', () => {
    speakSpanish()
    const error = makeHttpError(404, { detail: 'Client not found' })

    localizeCodedDetail(error)

    expect(error.response.data).toEqual({ detail: 'Client not found' })
  })

  it('returns the fallback for a missing code', () => {
    expect(translateErrorCode(undefined, 'Plain text')).toBe('Plain text')
  })
})

async function speakRealSpanish() {
  const { createInstance } = await vi.importActual<typeof import('i18next')>('i18next')
  const real = createInstance()
  await real.init({
    lng: 'es',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    resources: { en: { errors: enErrors }, es: { errors: esErrors } },
  })
  vi.spyOn(i18n, 't').mockImplementation(real.t.bind(real) as unknown as typeof i18n.t)
}

describe('error codes with the real i18next', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fills the message with the values the server sends', async () => {
    await speakRealSpanish()
    const error = makeHttpError(400, {
      detail: 'Date range must not exceed 90 days',
      code: 'DATE_RANGE_TOO_LONG',
      params: { max_days: 90 },
    })

    expect(getErrorMessage(error)).toBe('El rango de fechas no puede superar los 90 días')
  })

  it('keeps the server text when the values are missing', async () => {
    await speakRealSpanish()
    const error = makeHttpError(400, {
      detail: 'Date range must not exceed 90 days',
      code: 'DATE_RANGE_TOO_LONG',
    })

    expect(getErrorMessage(error)).toBe('Date range must not exceed 90 days')
  })

  it('keeps the server text when one of the values is missing', async () => {
    await speakRealSpanish()
    const detail = "Cannot archive role 'Operator' - 3 users are assigned"
    const error = makeHttpError(409, {
      detail,
      code: 'ROLE_HAS_USERS',
      params: { role: 'Operator' },
    })

    expect(getErrorMessage(error)).toBe(detail)
  })

  it('keeps the server text in a rewritten detail when the values are missing', async () => {
    await speakRealSpanish()
    const error = makeHttpError(400, {
      detail: 'Date range must not exceed 90 days',
      code: 'DATE_RANGE_TOO_LONG',
    })

    localizeCodedDetail(error)

    expect((error.response.data as { detail: string }).detail).toBe(
      'Date range must not exceed 90 days'
    )
  })

  it('keeps the server text of a messaging envelope whose message needs values', async () => {
    await speakRealSpanish()
    const error = makeHttpError(400, {
      error: { code: 'DATE_RANGE_TOO_LONG', message: 'Date range must not exceed 90 days' },
    })

    expect(getErrorMessage(error)).toBe('Date range must not exceed 90 days')
  })

  it('lets a caller replace a rewritten detail', async () => {
    await speakRealSpanish()
    const error = makeHttpError(409, {
      detail: 'Loan is already closed',
      code: 'LOAN_ALREADY_CLOSED',
    })
    localizeCodedDetail(error)
    const data = error.response.data as { detail: string }

    data.detail = 'Replaced'

    expect(data.detail).toBe('Replaced')
    expect(error.response.data).toEqual({ detail: 'Replaced', code: 'LOAN_ALREADY_CLOSED' })
  })
})
