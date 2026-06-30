/**
 * Aggregates verified payments per contract for Debt Summary breakdown.
 */

export interface ContractVerifiedSummary {
  contractNumber: string
  totalVerified: number
  verifiedCount: number
}

type PaymentForContractRollup = {
  debt_contract_number?: string | null
  // KAN-782: legacy rows can have a null payment_date. isSystemPayment already
  // null-guards it (a dateless payment is treated as a system payment).
  payment_date: string | null
  amount: string | number
}

type DebtForContractRollup = {
  contract_number?: string | null
  purchase_date?: string | null
}

/** Excludes primary-creditor payments (payment_date before debt purchase_date). */
export function isSystemPayment(
  payment: PaymentForContractRollup,
  purchaseDateMap: Map<string, string>
): boolean {
  const contractNum = payment.debt_contract_number
  if (!contractNum) return true
  const purchaseDate = purchaseDateMap.get(contractNum)
  if (purchaseDate && payment.payment_date && payment.payment_date < purchaseDate) {
    return false
  }
  return true
}

export function buildPurchaseDateMap(
  debts: DebtForContractRollup[] | undefined
): Map<string, string> {
  const map = new Map<string, string>()
  ;(debts ?? []).forEach((d) => {
    if (d.contract_number && d.purchase_date) {
      map.set(d.contract_number, d.purchase_date)
    }
  })
  return map
}

/**
 * One card per client debt contract. Verified totals use full payment history
 * (caller supplies all verified rows). Pending/cancelled are excluded upstream.
 */
export function buildVerifiedPaymentsByContract(
  debts: DebtForContractRollup[] | undefined,
  verifiedPayments: PaymentForContractRollup[],
  purchaseDateMap: Map<string, string>
): ContractVerifiedSummary[] {
  const contractNumbers = [
    ...new Set((debts ?? []).map((d) => d.contract_number).filter((c): c is string => Boolean(c))),
  ]

  const systemVerified = verifiedPayments.filter((p) => isSystemPayment(p, purchaseDateMap))

  return contractNumbers.map((contractNumber) => {
    const matching = systemVerified.filter((p) => p.debt_contract_number === contractNumber)
    return {
      contractNumber,
      totalVerified: matching.reduce((sum, p) => sum + Number(p.amount), 0),
      verifiedCount: matching.length,
    }
  })
}
