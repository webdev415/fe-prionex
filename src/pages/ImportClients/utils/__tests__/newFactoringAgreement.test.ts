import { describe, expect, it } from 'vitest'

import {
  EMPTY_NEW_FACTORING_AGREEMENT,
  buildNewFactoringAgreementJson,
  parseSaleTypeConflict,
} from '../newFactoringAgreement'

/** The shape axios rejects with — what `getErrorCode` and the status check read. */
function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

const filledAgreement = {
  ...EMPTY_NEW_FACTORING_AGREEMENT,
  agreement_number: '  30-09-26ФБ ',
  previous_lender: ' ТОВ «Продавець» ',
  contract_purchase_date: '2026-09-30T12:00:00.000Z',
  reporting_date: '2026-09-29T12:00:00.000Z',
}

describe('EMPTY_NEW_FACTORING_AGREEMENT', () => {
  it('starts a new sale as cession', () => {
    expect(EMPTY_NEW_FACTORING_AGREEMENT.sale_type).toBe('cession')
  })
})

describe('buildNewFactoringAgreementJson', () => {
  it('sends cession when the type field was left alone', () => {
    const body = JSON.parse(buildNewFactoringAgreementJson(filledAgreement))

    expect(body).toEqual({
      agreement_number: '30-09-26ФБ',
      previous_lender: 'ТОВ «Продавець»',
      contract_purchase_date: '2026-09-30',
      reporting_date: '2026-09-29',
      sale_type: 'cession',
    })
  })

  it('sends factoring when factoring was chosen', () => {
    const body = JSON.parse(
      buildNewFactoringAgreementJson({ ...filledAgreement, sale_type: 'factoring' })
    )

    expect(body.sale_type).toBe('factoring')
  })

  it('leaves out the optional fields the operator did not fill', () => {
    const body = JSON.parse(
      buildNewFactoringAgreementJson({
        ...EMPTY_NEW_FACTORING_AGREEMENT,
        agreement_number: 'A-1',
        previous_lender: '   ',
      })
    )

    // "Who sold" left blank falls back to the seller's legal name server-side.
    expect(body).toEqual({ agreement_number: 'A-1', sale_type: 'cession' })
  })
})

describe('parseSaleTypeConflict', () => {
  /** Step 1 as the upload was sent. */
  const target = { sellerId: '7', agreementNumber: '30-09-26ФБ' }

  it('reads the existing type off a 409 SALE_TYPE_CONFLICT and ties it to what was sent', () => {
    const error = httpError(409, {
      detail: 'Agreement already exists with sale_type factoring',
      code: 'SALE_TYPE_CONFLICT',
      params: { existing_sale_type: 'factoring' },
    })

    // A server from before `reason` — the reason stays unknown.
    expect(parseSaleTypeConflict(error, target)).toEqual({
      existingSaleType: 'factoring',
      reason: null,
      sellerId: '7',
      agreementNumber: '30-09-26ФБ',
    })
  })

  it.each(['stored_type', 'debt_types', 'foreign_project_debts', 'service_caller'])(
    'reads the reason %s',
    (reason) => {
      const error = httpError(409, {
        detail: 'conflict',
        code: 'SALE_TYPE_CONFLICT',
        params: { existing_sale_type: null, reason },
      })

      expect(parseSaleTypeConflict(error, target)).toMatchObject({ reason })
    }
  )

  // A reason this screen does not know is no reason: never a guessed message.
  it.each([
    ['a reason outside the known set', 'debt_project'],
    ['another casing', 'Stored_Type'],
    ['an empty string', ''],
    ['null', null],
    ['a number', 1],
    ['an object', { reason: 'debt_types' }],
  ])('reads %s as no reason', (_label, reason) => {
    const error = httpError(409, {
      detail: 'conflict',
      code: 'SALE_TYPE_CONFLICT',
      params: { existing_sale_type: 'cession', reason },
    })

    expect(parseSaleTypeConflict(error, target)).toMatchObject({
      existingSaleType: 'cession',
      reason: null,
    })
  })

  it('keeps the number as the upload sent it — trimmed', () => {
    const error = httpError(409, { detail: 'x', code: 'SALE_TYPE_CONFLICT', params: {} })

    expect(
      parseSaleTypeConflict(error, { sellerId: '7', agreementNumber: '  30-09-26ФБ ' })
    ).toMatchObject({ agreementNumber: '30-09-26ФБ' })
  })

  it.each([
    ['null', { existing_sale_type: null }],
    ['absent from params', {}],
    ['a value outside the known set', { existing_sale_type: 'credit' }],
    ['no params at all', undefined],
  ])('still reports the conflict when the existing type is %s — with no type', (_l, params) => {
    const error = httpError(409, { detail: 'conflict', code: 'SALE_TYPE_CONFLICT', params })

    expect(parseSaleTypeConflict(error, target)).toEqual({
      ...target,
      existingSaleType: null,
      reason: null,
    })
  })

  it.each([
    ['a 409 with another code', httpError(409, { detail: 'x', code: 'LOAN_ALREADY_CLOSED' })],
    ['a 409 without a code', httpError(409, { detail: 'Duplicate' })],
    [
      'the same code on another status',
      httpError(422, { detail: 'x', code: 'SALE_TYPE_CONFLICT' }),
    ],
    ['a 502 from the import service', httpError(502, { detail: 'client-service failed' })],
    ['a network failure', Object.assign(new Error('Network Error'), { isAxiosError: true })],
    ['a plain error', new Error('boom')],
  ])('is null for %s, so the upload keeps its usual error path', (_label, error) => {
    expect(parseSaleTypeConflict(error, target)).toBeNull()
  })
})
