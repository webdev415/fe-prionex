import { describe, expect, it, vi } from 'vitest'

// The shared test setup mocks i18next core, so @/lib/i18n has no real `t`.
// Provide a passthrough that interpolates {{id}} for the unknown-entity fallbacks.
vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/i18n')>()
  return {
    ...actual,
    default: {
      t: (key: string, opts?: { defaultValue?: string; id?: number | string }) =>
        (opts?.defaultValue ?? key).replace('{{id}}', String(opts?.id ?? '')),
    },
  }
})

import { mapLegalDocumentItem } from '../documentMappers'
import type { LegalDocumentListItem } from '../types'

const clientLookup = {
  clientsById: new Map([
    [
      111,
      {
        id: 111,
        first_name: 'Ivan',
        last_name: 'Bezzub',
        legacy_id: '1971389989240',
      } as never,
    ],
  ]),
  lawyersByUserId: new Map(),
}

describe('mapLegalDocumentItem contract display', () => {
  it('shows stored contract_number and formats client as CL-code · name', () => {
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
      clientLookup
    )

    expect(row.clientName).toBe('CL-00111 · Ivan Bezzub')
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
      clientLookup
    )

    expect(row.contractId).toBe('—')
  })

  it('falls back to a numbered placeholder for unknown client and assignee', () => {
    const row = mapLegalDocumentItem(
      {
        id: 'doc-3',
        number: 'VIN-2026-003',
        title: 'Unknown parties',
        document_type: 'incoming',
        action: 'uploaded',
        client_id: 999,
        contract_number: null,
        assigned_to_user_id: 77,
        created_at: '2026-07-03T08:56:00Z',
        filename: 'scan.pdf',
        source_message_id: null,
      } as LegalDocumentListItem,
      clientLookup
    )

    expect(row.clientName).toBe('Client #999')
    expect(row.assigneeName).toBe('User #77')
  })
})
