import type { CallContract, CallMatchedClient } from '../components/CallClientContracts'
import type { IncomingCallClient, IncomingCallData, LoanInfo } from '../types'

function toContract(loan: LoanInfo): CallContract {
  return {
    id: String(loan.loan_id),
    number: loan.contract_number,
    status: loan.status,
    // The debt's latest restructuring status, whatever it is — PM's rule, and
    // deliberately unfiltered. "PP" in the design turned out to be a slip for
    // "RR": there is only one marker.
    marker: loan.restructuring_status ?? null,
    counterparty: loan.seller_name ?? '',
    loanPrincipal: Number(loan.principal_amount ?? loan.remaining_debt) || 0,
    debt: Number(loan.remaining_debt) || 0,
    saleDate: loan.purchase_date ?? null,
    lastContact: null,
  }
}

function toMatchedClient(client: IncomingCallClient): CallMatchedClient {
  const lastContact = client.recent_interactions?.[0]?.interaction_date ?? null
  return {
    clientId: client.client_id,
    clientName: client.client_name,
    contactCategory: client.contact_category ?? null,
    // The annotation on the matched number, which is where an operator records
    // whose phone it actually is. Absent on plenty of contacts, so it names the
    // third party when it can and the category carries the fact when it cannot.
    thirdPartyName: client.contact_comment?.trim() || null,
    contracts: (client.loans ?? []).map((loan) => ({ ...toContract(loan), lastContact })),
  }
}

/**
 * Every client the incoming number resolved to, with their contracts.
 *
 * One number can sit on several client cards and the interaction may be filed
 * against any of them, so this returns all matches rather than choosing one.
 * Falls back to the flat `loans` list when the payload names no clients, which
 * is what an older screen-pop looks like.
 */
export function buildMatchedClients(incomingCall: IncomingCallData | null): CallMatchedClient[] {
  if (!incomingCall) return []

  const clients = incomingCall.clients ?? []
  if (clients.length > 0) return clients.map(toMatchedClient)

  if (incomingCall.client_id == null) return []
  return [
    {
      clientId: incomingCall.client_id,
      clientName: incomingCall.client_name || 'Unknown',
      // The flat fallback shape predates per-client contact annotation.
      contactCategory: null,
      thirdPartyName: null,
      contracts: (incomingCall.loans ?? []).map(toContract),
    },
  ]
}
