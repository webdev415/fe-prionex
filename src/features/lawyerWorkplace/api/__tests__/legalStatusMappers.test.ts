import { describe, expect, it } from 'vitest'
import {
  buildLetterActivityLog,
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

  it('prefers confirmed letter type over suggested letter type', () => {
    const message = {
      suggested_letter_type_id: 'complaint',
      confirmed_letter_type_id: 'attorney_request',
      received_at: '2026-06-24T09:00:00Z',
    } as LegalMessageDetail

    const parameters = buildLetterParameters(message, {
      letterTypesById: new Map<string, LegalLetterType>([
        [
          'attorney_request',
          {
            id: 'attorney_request',
            slug: 'attorney_request',
            name: 'Attorney request',
            sla_days: 7,
          } as LegalLetterType,
        ],
      ]),
    })

    expect(parameters.letterType).toBe('attorney_request')
  })
})

describe('buildLetterActivityLog', () => {
  const receivedAt = '2026-07-03T06:42:00Z'
  const updatedAt = '2026-07-03T07:15:00Z'

  it('shows auto-classified only for auto_processed letters', () => {
    const entries = buildLetterActivityLog({
      receivedAt,
      processingStatus: 'auto_processed',
      suggestedLetterTypeId: 'attorney_request',
      confirmedLetterTypeId: 'attorney_request',
      legalTaskId: 501,
    })

    expect(entries.map((entry) => entry.fallback)).toEqual([
      'Letter received',
      'Auto-classified',
      'Task created on kanban board',
    ])
  })

  it('shows parameters confirmed for manually confirmed letters', () => {
    const entries = buildLetterActivityLog({
      receivedAt,
      updatedAt,
      processingStatus: 'in_progress',
      suggestedLetterTypeId: 'complaint',
      confirmedLetterTypeId: 'attorney_request',
      legalTaskId: 501,
    })

    expect(entries.map((entry) => entry.fallback)).toEqual([
      'Letter received',
      'Parameters confirmed',
      'Task created on kanban board',
    ])
    expect(entries[1]?.timestamp).toBe(updatedAt)
  })

  it('shows type suggested when only a suggestion exists', () => {
    const entries = buildLetterActivityLog({
      receivedAt,
      processingStatus: 'new',
      suggestedLetterTypeId: 'attorney_request',
    })

    expect(entries.map((entry) => entry.fallback)).toEqual(['Letter received', 'Type suggested'])
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
