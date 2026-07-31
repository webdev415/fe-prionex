import type { IncomingModalLoan } from '@/stores/callStore'

import type { IncomingCallClient, IncomingCallData } from '../types'

/**
 * The client the popup is anchored to: the one the backend resolved as primary,
 * falling back to the highest-ranked match. Null when the caller is unknown.
 */
export function resolvePrimaryClient(
  incomingCall: IncomingCallData | null
): IncomingCallClient | null {
  const clients = incomingCall?.clients ?? []
  if (clients.length === 0) return null
  return clients.find((c) => c.client_id === incomingCall?.client_id) ?? clients[0]
}

/**
 * Maps the wire payload onto the modal's loan cards.
 *
 * The design's two groups are the caller's own debts versus those of other
 * clients reachable on the same number — not a priority score. `priority` is the
 * channel the card component already groups on, so it carries that distinction.
 */
export function buildIncomingCallLoans(
  incomingCall: IncomingCallData | null
): IncomingModalLoan[] | undefined {
  if (!incomingCall) return undefined

  const primaryClientId = resolvePrimaryClient(incomingCall)?.client_id

  return incomingCall.loans?.map((loan) => {
    const owner = incomingCall.clients?.find((c) => c.loans.some((l) => l.loan_id === loan.loan_id))
    const isPrimary = owner ? owner.client_id === primaryClientId : true

    return {
      id: loan.loan_id.toString(),
      clientName: owner?.client_name || incomingCall.client_name || 'Unknown',
      loanNumber: loan.contract_number,
      counterparty: loan.seller_name ?? '',
      loanPrincipal: Number(loan.principal_amount ?? loan.remaining_debt) || 0,
      debt: Number(loan.remaining_debt) || 0,
      status: loan.status,
      saleDate: loan.purchase_date ?? '',
      lastContact: owner?.recent_interactions?.[0]?.interaction_date ?? '',
      priority: isPrimary ? 'Critical' : 'High',
      score: 0,
    }
  })
}
