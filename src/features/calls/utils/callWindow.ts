import type { CallContract, CallMatchedClient } from '../components/CallClientContracts'
import type { IncomingCallClient, IncomingCallData, LoanInfo } from '../types'

function toContract(loan: LoanInfo): CallContract {
  return {
    id: String(loan.loan_id),
    number: loan.contract_number,
    status: loan.status,
    // The design shows RR / PP chips beside the status, but the payload carries
    // nothing that identifies a restructuring or a payment plan. Left absent
    // rather than guessed: a wrong marker on a debt card is worse than none.
    marker: null,
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
    // The design groups third parties separately, but the payload only names
    // the contact type ("Mobile"), not its category — contact types 7-9 are the
    // third-party phones. Until that reaches the wire, every match is shown as
    // the client's own.
    thirdPartyName: null,
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
      thirdPartyName: null,
      contracts: (incomingCall.loans ?? []).map(toContract),
    },
  ]
}
