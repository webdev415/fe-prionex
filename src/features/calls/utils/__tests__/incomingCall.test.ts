import { describe, expect, it } from 'vitest'

import type { IncomingCallClient, IncomingCallData } from '../../types'
import { buildIncomingCallLoans, resolvePrimaryClient } from '../incomingCall'

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

  it('treats loans as the caller’s own when no client breakdown is present', () => {
    const data = payload({ loans: [primaryLoan] })

    expect(buildIncomingCallLoans(data)!.map((r) => r.priority)).toEqual(['Critical'])
  })

  it('returns undefined without an incoming call', () => {
    expect(buildIncomingCallLoans(null)).toBeUndefined()
  })
})
