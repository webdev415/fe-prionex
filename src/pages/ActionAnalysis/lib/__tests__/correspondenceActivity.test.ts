import { describe, it, expect } from 'vitest'
import type { IncomingRegistryItem, OutgoingRegistryItem } from '@/features/lawyerWorkplace'
import { mergeCorrespondenceActivity } from '../correspondenceActivity'

const incoming: IncomingRegistryItem[] = [
  {
    id: 1,
    number: '7',
    received_date: '2026-07-10T09:00:00Z',
    sender_email: 'client@example.com',
    summary: 'Complaint about interest',
    letter_type: { id: 'complaint', name: 'Complaint', color_id: 'red' },
    client: { id: 100, name: 'John Doe' },
    source: 'letter',
  },
]

const outgoing: OutgoingRegistryItem[] = [
  {
    id: 5,
    number: '2307/01',
    request_received_at: '2026-07-08T09:00:00Z',
    sender_email: 'legal@prionex.ua',
    recipient_email: 'nbu@bank.gov.ua',
    letter_type: { id: 'nbu', name: 'NBU reply', color_id: 'teal' },
    client_name: null,
    institution_name: 'National Bank of Ukraine',
    issued_date: '2026-07-12T09:00:00Z',
    lawyer: { id: 9, name: 'Jane Lawyer' },
  },
]

describe('mergeCorrespondenceActivity', () => {
  it('unions both registries and sorts newest-first', () => {
    const rows = mergeCorrespondenceActivity(incoming, outgoing)

    expect(rows).toHaveLength(2)
    // outgoing issued_date (07-12) is newer than incoming received_date (07-10)
    expect(rows[0].direction).toBe('outgoing')
    expect(rows[0].id).toBe('out-5')
    expect(rows[1].direction).toBe('incoming')
    expect(rows[1].id).toBe('in-1')
  })

  it('normalises the responsible + party fields per direction', () => {
    const rows = mergeCorrespondenceActivity(incoming, outgoing)

    const incomingRow = rows.find((r) => r.direction === 'incoming')!
    expect(incomingRow.party).toBe('John Doe')
    expect(incomingRow.responsible).toBeNull()

    const outgoingRow = rows.find((r) => r.direction === 'outgoing')!
    // client_name is null → falls back to institution_name
    expect(outgoingRow.party).toBe('National Bank of Ukraine')
    expect(outgoingRow.responsible).toBe('Jane Lawyer')
  })

  it('returns an empty list when both registries are empty', () => {
    expect(mergeCorrespondenceActivity([], [])).toEqual([])
  })
})
