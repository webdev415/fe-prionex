const CLOSED_STATUS = 'closed'

export function isOpenLoan(loan: { status?: string | null }): boolean {
  return (loan.status ?? '').trim().toLowerCase() !== CLOSED_STATUS
}
