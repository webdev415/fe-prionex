import { describe, expect, it } from 'vitest'
import { mapLegalDocumentItem } from '../documentMappers'
import type { LegalDocumentListItem } from '../types'

describe('mapLegalDocumentItem contract display', () => {
  it('shows stored contract_number and does not fall back to legacy_id', () => {
    const row = mapLegalDocumentItem(
      {
        id: 'doc-1',
        number: 'VIN-2026-001',
        title: 'RE: Hi CRM-Prionex',
        document_type: 'outgoing',
        action: 'generated',
        client_id: 111,
        contract_number: '27427',
        assigned_to_user_id: 10,
        created_at: '2026-07-03T08:56:00Z',
        filename: 'reply.eml',
        source_message_id: null,
      } as LegalDocumentListItem,
      {
        clientsById: new Map([
          [
            111,
            {
              id: 111,
              first_name: 'Client-111',
              last_name: 'Bezzub',
              legacy_id: '1971389989240',
            } as never,
          ],
        ]),
        lawyersByUserId: new Map(),
      }
    )

    expect(row.contractId).toBe('27427')
  })

  it('shows em dash when contract_number is missing', () => {
    const row = mapLegalDocumentItem(
      {
        id: 'doc-2',
        number: 'VIN-2026-002',
        title: 'Missing contract',
        document_type: 'outgoing',
        action: 'generated',
        client_id: 111,
        contract_number: null,
        assigned_to_user_id: 10,
        created_at: '2026-07-03T08:56:00Z',
        filename: 'reply.eml',
        source_message_id: null,
      } as LegalDocumentListItem,
      {
        clientsById: new Map([
          [
            111,
            {
              id: 111,
              first_name: 'Client-111',
              last_name: 'Bezzub',
              legacy_id: '1971389989240',
            } as never,
          ],
        ]),
        lawyersByUserId: new Map(),
      }
    )

    expect(row.contractId).toBe('—')
  })
})
