import { describe, expect, it } from 'vitest'

import type { IncomingCallClient, IncomingCallData } from '../../types'
import { buildIncomingCallLoans, isCallerUnresolved, resolvePrimaryClient } from '../incomingCall'

function client(overrides: Partial<IncomingCallClient> = {}): IncomingCallClient {
  return {
    client_id: 1,
    client_name: 'Коваленко Іван',
    responsible_employee_id: null,
    contact_comment: null,
    contact_source: null,
    contact_type_name: null,
    recent_interactions: [],
    loans: [],
    ...overrides,
  }
}

function payload(overrides: Partial<IncomingCallData> = {}): IncomingCallData {
  return {
    call_id: 'call-1',
    customer_phone: '+380501234567',
    agent_extension: '1004',
    loan_count: 0,
    total_debt: '0',
    loans: [],
    ...overrides,
  }
}

describe('resolvePrimaryClient', () => {
  it('returns null when the caller matched nobody', () => {
    expect(resolvePrimaryClient(payload())).toBeNull()
  })

  it('prefers the client the backend resolved as primary', () => {
    const data = payload({
      client_id: 2,
      clients: [client({ client_id: 1 }), client({ client_id: 2, client_name: 'Марія' })],
    })

    expect(resolvePrimaryClient(data)?.client_id).toBe(2)
  })

  it('falls back to the highest-ranked match when no primary id is set', () => {
    const data = payload({ clients: [client({ client_id: 9 }), client({ client_id: 3 })] })

    expect(resolvePrimaryClient(data)?.client_id).toBe(9)
  })

  it("lets the operator's choice override the backend primary", () => {
    const data = payload({
      client_id: 1,
      clients: [client({ client_id: 1 }), client({ client_id: 2 })],
    })

    expect(resolvePrimaryClient(data, 2)?.client_id).toBe(2)
  })

  it('ignores a selection that is not among the candidates', () => {
    const data = payload({ client_id: 1, clients: [client({ client_id: 1 })] })

    expect(resolvePrimaryClient(data, 999)?.client_id).toBe(1)
  })
})

describe('isCallerUnresolved', () => {
  it('is true when the number matched nobody', () => {
    expect(isCallerUnresolved(payload({ clients: [] }))).toBe(true)
  })

  it('is false when at least one client matched', () => {
    expect(isCallerUnresolved(payload({ clients: [client()] }))).toBe(false)
  })

  it('is false without an incoming call at all', () => {
    expect(isCallerUnresolved(null)).toBe(false)
  })
})

describe('buildIncomingCallLoans — the owner each loan links to', () => {
  const anchored = client({
    client_id: 1,
    client_name: 'Коваленко Іван',
    loans: [{ loan_id: 10, contract_number: 'L-10', remaining_debt: '100', status: 'active' }],
  })
  const other = client({
    client_id: 2,
    client_name: 'Мельник Андрій',
    loans: [{ loan_id: 20, contract_number: 'L-20', remaining_debt: '200', status: 'active' }],
  })
  const call = payload({
    client_id: 1,
    clients: [anchored, other],
    loans: [
      { loan_id: 10, contract_number: 'L-10', remaining_debt: '100', status: 'active' },
      { loan_id: 20, contract_number: 'L-20', remaining_debt: '200', status: 'active' },
    ],
  })

  it('carries the owning client of each loan, not the anchored one', () => {
    const loans = buildIncomingCallLoans(call)

    // A third-party loan belongs to someone other than the client the popup is
    // anchored to; without its own id the card cannot link anywhere, which is
    // how its "View Client" ended up a dead button.
    expect(loans?.find((l) => l.id === '10')?.clientId).toBe(1)
    expect(loans?.find((l) => l.id === '20')?.clientId).toBe(2)
  })

  it('still names an owner when the loan matches no listed client', () => {
    const orphan = payload({
      client_id: 7,
      clients: [],
      loans: [{ loan_id: 30, contract_number: 'L-30', remaining_debt: '300', status: 'active' }],
    })

    expect(buildIncomingCallLoans(orphan)?.[0]?.clientId).toBe(7)
  })

  it('leaves the id absent when nothing identifies the caller', () => {
    const unknown = payload({
      clients: [],
      loans: [{ loan_id: 40, contract_number: 'L-40', remaining_debt: '400', status: 'active' }],
    })

    // The card must render without a link rather than point at nobody.
    expect(buildIncomingCallLoans(unknown)?.[0]?.clientId).toBeNull()
  })
})

describe('buildIncomingCallLoans', () => {
  const primaryLoan = {
    loan_id: 10,
    contract_number: 'LN-1',
    remaining_debt: '5000',
    status: 'active',
  }
  const thirdPartyLoan = {
    loan_id: 20,
    contract_number: 'LN-2',
    remaining_debt: '3000',
    status: 'active',
  }

  it("groups the caller's own debts apart from other clients' on the same number", () => {
    const data = payload({
      client_id: 1,
      loans: [primaryLoan, thirdPartyLoan],
      clients: [
        client({ client_id: 1, loans: [primaryLoan] }),
        client({ client_id: 2, client_name: 'Марія Коваль', loans: [thirdPartyLoan] }),
      ],
    })

    const rows = buildIncomingCallLoans(data)!

    // 'Critical' is what the modal groups under "Primary loans"; before this
    // every row was hardcoded 'Medium' and the primary group never rendered.
    expect(rows.map((r) => r.priority)).toEqual(['Critical', 'High'])
    expect(rows[1].clientName).toBe('Марія Коваль')
  })

  it('carries counterparty, sale date and last contact instead of blanks', () => {
    const enriched = {
      ...primaryLoan,
      seller_name: 'Bank X',
      purchase_date: '2024-03-12',
      principal_amount: 40000,
    }
    const data = payload({
      client_id: 1,
      loans: [enriched],
      clients: [
        client({
          client_id: 1,
          loans: [enriched],
          recent_interactions: [
            {
              id: 1,
              interaction_date: '2025-12-03T14:30:00',
              type_name: 'Call',
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

    const [row] = buildIncomingCallLoans(data)!

    expect(row.counterparty).toBe('Bank X')
    expect(row.saleDate).toBe('2024-03-12')
    expect(row.lastContact).toBe('2025-12-03T14:30:00')
    expect(row.loanPrincipal).toBe(40000)
  })

  it('re-groups around the client the operator picked', () => {
    const data = payload({
      client_id: 1,
      loans: [primaryLoan, thirdPartyLoan],
      clients: [
        client({ client_id: 1, loans: [primaryLoan] }),
        client({ client_id: 2, loans: [thirdPartyLoan] }),
      ],
    })

    // Picking client 2 makes their debt the primary group, not the default one.
    expect(buildIncomingCallLoans(data, 2)!.map((r) => r.priority)).toEqual(['High', 'Critical'])
  })

  it('treats loans as the caller’s own when no client breakdown is present', () => {
    const data = payload({ loans: [primaryLoan] })

    expect(buildIncomingCallLoans(data)!.map((r) => r.priority)).toEqual(['Critical'])
  })

  it('returns undefined without an incoming call', () => {
    expect(buildIncomingCallLoans(null)).toBeUndefined()
  })
})
