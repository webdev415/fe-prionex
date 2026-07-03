import { describe, expect, it } from 'vitest'
import {
  buildLetterParameters,
  isLetterParametersReadOnly,
  mapProcessingStatusToDisplay,
} from '../mappers'
import type { LegalMessageDetail, LegalLetterType } from '../types'

describe('buildLetterParameters', () => {
  it('uses debt contract number instead of client code', () => {
    const message = {
      suggested_letter_type_id: 'complaint',
      suggested_client_id: 111,
      suggested_lawyer_user_id: 10,
      suggested_client_source: 'sender_email',
      suggested_contract_number: '27427',
      confirmed_contract_number: null,
      received_at: '2026-06-24T09:00:00Z',
    } as LegalMessageDetail

    const parameters = buildLetterParameters(message, {
      letterTypesById: new Map<string, LegalLetterType>([
        [
          'complaint',
          {
            id: 'complaint',
            slug: 'complaint',
            name: 'Complaint',
            sla_days: 7,
          } as LegalLetterType,
        ],
      ]),
    })

    expect(parameters.contractLabel).toBe('27427')
    expect(parameters.contractId).toBe('27427')
  })

  it('prefers confirmed contract over suggested contract', () => {
    const message = {
      suggested_letter_type_id: 'complaint',
      suggested_client_id: 111,
      suggested_lawyer_user_id: 10,
      suggested_contract_number: '27427',
      confirmed_contract_number: '99999',
      received_at: '2026-06-24T09:00:00Z',
    } as LegalMessageDetail

    const parameters = buildLetterParameters(message)
    expect(parameters.contractLabel).toBe('99999')
  })
})

describe('mapProcessingStatusToDisplay', () => {
  it('maps auto_processed with manual review to in_progress badge', () => {
    expect(mapProcessingStatusToDisplay('auto_processed', true)).toBe('in_progress')
  })

  it('maps full auto_processed without manual review to auto badge', () => {
    expect(mapProcessingStatusToDisplay('auto_processed', false)).toBe('auto_processed')
  })
})

describe('isLetterParametersReadOnly', () => {
  it('keeps partial auto letters editable', () => {
    expect(
      isLetterParametersReadOnly({
        status: 'in_progress',
        isUnprocessed: true,
      })
    ).toBe(false)
  })

  it('locks full auto-processed letters', () => {
    expect(
      isLetterParametersReadOnly({
        status: 'auto_processed',
        isUnprocessed: false,
      })
    ).toBe(true)
  })
})
