import type { IncomingModalLoan } from '@/stores/callStore'

import type { IncomingCallClient, IncomingCallData } from '../types'

/**
 * The client the popup is anchored to.
 *
 * An explicit operator choice wins, then the client the backend resolved as
 * primary, then the highest-ranked match. Null when the caller is unknown.
 */
export function resolvePrimaryClient(
  incomingCall: IncomingCallData | null,
  selectedClientId?: number | null
): IncomingCallClient | null {
  const clients = incomingCall?.clients ?? []
  if (clients.length === 0) return null
  if (selectedClientId != null) {
    const chosen = clients.find((c) => c.client_id === selectedClientId)
    if (chosen) return chosen
  }
  return clients.find((c) => c.client_id === incomingCall?.client_id) ?? clients[0]
}

/** True when the number resolved to nobody in this operator's projects. */
export function isCallerUnresolved(incomingCall: IncomingCallData | null): boolean {
  return !!incomingCall && (incomingCall.clients?.length ?? 0) === 0
}

/**
 * Maps the wire payload onto the modal's loan cards.
 *
 * The design's two groups are the anchored client's own debts versus those of
 * other clients reachable on the same number — not a priority score. `priority`
 * is the channel the card component already groups on, so it carries that
 * distinction, and it follows the operator's choice when they pick a client.
 */
export function buildIncomingCallLoans(
  incomingCall: IncomingCallData | null,
  selectedClientId?: number | null
): IncomingModalLoan[] | undefined {
  if (!incomingCall) return undefined

  const primaryClientId = resolvePrimaryClient(incomingCall, selectedClientId)?.client_id
  const hasCandidates = (incomingCall.clients?.length ?? 0) > 0

  return incomingCall.loans?.map((loan) => {
    const owner = incomingCall.clients?.find((c) => c.loans.some((l) => l.loan_id === loan.loan_id))
    // With candidates listed, a loan matching none of them belongs to somebody
    // the payload did not name. Grouping it as the caller's own debt asserts an
    // ownership nothing supports — the same wrong attribution the missing link
    // below avoids, just in words instead of a destination.
    const isPrimary = owner ? owner.client_id === primaryClientId : !hasCandidates

    return {
      id: loan.loan_id.toString(),
      // Only when there was nothing to match against. With candidates present,
      // an unmatched loan belongs to somebody the payload did not name, and
      // linking it to the anchored client would send the operator confidently
      // to the wrong person's card.
      clientId: owner?.client_id ?? (hasCandidates ? null : (incomingCall.client_id ?? null)),
      clientName:
        owner?.client_name || (hasCandidates ? 'Unknown' : incomingCall.client_name) || 'Unknown',
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
