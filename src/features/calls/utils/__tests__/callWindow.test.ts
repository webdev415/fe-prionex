import { describe, it, expect } from 'vitest'

import { buildMatchedClients } from '../callWindow'
import type { IncomingCallClient, IncomingCallData } from '../../types'

const loan = (id: number, over = {}) => ({
  loan_id: id,
  contract_number: `L-${id}`,
  remaining_debt: '5000',
  principal_amount: 4000,
  status: 'active',
  seller_name: 'Bank X',
  purchase_date: '2025-11-02',
  ...over,
})

const client = (id: number, over: Partial<IncomingCallClient> = {}): IncomingCallClient => ({
  client_id: id,
  client_name: `Client ${id}`,
  responsible_employee_id: null,
  contact_comment: null,
  contact_source: null,
  contact_type_name: null,
  contact_category: null,
  recent_interactions: [],
  loans: [loan(id * 10)],
  ...over,
})

const payload = (over: Partial<IncomingCallData> = {}): IncomingCallData => ({
  call_id: 'c1',
  customer_phone: '380971234567',
  agent_extension: '2091',
  loan_count: 0,
  total_debt: '0',
  loans: [],
  ...over,
})

describe('buildMatchedClients', () => {
  it('carries whose number the caller rang in on', () => {
    const [built] = buildMatchedClients(
      payload({
        clients: [client(1, { contact_category: 'third_party', contact_comment: '  Sister  ' })],
      })
    )

    expect(built.contactCategory).toBe('third_party')
    // Trimmed: the annotation is free text an operator typed mid-call.
    expect(built.thirdPartyName).toBe('Sister')
  })

  it('keeps the category when the number is annotated with nothing', () => {
    const [built] = buildMatchedClients(
      payload({ clients: [client(1, { contact_category: 'third_party', contact_comment: '   ' })] })
    )

    // The fact and the name are independently absent. Losing the fact because
    // the name is missing is what renders a third party as the debtor.
    expect(built.contactCategory).toBe('third_party')
    expect(built.thirdPartyName).toBeNull()
  })

  it('returns every client the number resolved to', () => {
    const result = buildMatchedClients(payload({ clients: [client(1), client(2), client(3)] }))

    // The interaction can be filed against any of them, so none may be dropped.
    expect(result.map((c) => c.clientId)).toEqual([1, 2, 3])
  })

  it('carries each client own contracts', () => {
    const result = buildMatchedClients(payload({ clients: [client(1), client(2)] }))

    expect(result[0].contracts.map((c) => c.number)).toEqual(['L-10'])
    expect(result[1].contracts.map((c) => c.number)).toEqual(['L-20'])
  })

  it('maps a contract onto the fields the card shows', () => {
    const result = buildMatchedClients(payload({ clients: [client(1)] }))

    expect(result[0].contracts[0]).toMatchObject({
      number: 'L-10',
      counterparty: 'Bank X',
      loanPrincipal: 4000,
      debt: 5000,
      saleDate: '2025-11-02',
    })
  })

  it('falls back to the debt when a loan reports no principal', () => {
    const result = buildMatchedClients(
      payload({ clients: [client(1, { loans: [loan(10, { principal_amount: null })] })] })
    )

    // Rendering 0 next to a real debt would read as a settled contract.
    expect(result[0].contracts[0].loanPrincipal).toBe(5000)
  })

  it('takes last contact from the most recent interaction', () => {
    const result = buildMatchedClients(
      payload({
        clients: [
          client(1, {
            recent_interactions: [
              {
                id: 1,
                interaction_date: '2026-08-01T10:00:00Z',
                type_name: null,
                result_name: null,
                direction: null,
                channel: null,
                summary: null,
                user_name: null,
              },
            ],
          }),
        ],
      })
    )

    expect(result[0].contracts[0].lastContact).toBe('2026-08-01T10:00:00Z')
  })

  it('leaves the third-party name and marker absent rather than inventing them', () => {
    const result = buildMatchedClients(payload({ clients: [client(1)] }))

    // Neither reaches the wire yet. A wrong marker on a debt card, or calling
    // the caller a third party, is worse than showing nothing.
    expect(result[0].thirdPartyName).toBeNull()
    expect(result[0].contracts[0].marker).toBeNull()
  })

  it('still shows a caller whose payload names no clients', () => {
    const result = buildMatchedClients(
      payload({ client_id: 7, client_name: 'Older Payload', loans: [loan(70)] })
    )

    // An older screen-pop carries a flat loan list and no clients array.
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ clientId: 7, clientName: 'Older Payload' })
  })

  it('returns nothing for an unknown caller', () => {
    expect(buildMatchedClients(payload())).toEqual([])
    expect(buildMatchedClients(null)).toEqual([])
  })
})
