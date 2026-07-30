export interface PaymentHistoryPagination {
  totalPages: number
  rangeStart: number
  rangeEnd: number
}

export function getPaymentHistoryPagination(
  totalPayments: number,
  currentPage: number,
  pageSize: number
): PaymentHistoryPagination {
  const safeTotal = Math.max(0, totalPayments)
  const totalPages = pageSize > 0 ? Math.ceil(safeTotal / pageSize) : 0

  if (safeTotal === 0) {
    return { totalPages, rangeStart: 0, rangeEnd: 0 }
  }

  const rangeStart = (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, safeTotal)

  return { totalPages, rangeStart, rangeEnd }
}
