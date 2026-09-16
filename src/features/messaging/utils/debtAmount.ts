export function formatDebtAmount(amount: number | string): string {
  const value = Number(amount)
  return Number.isFinite(value) ? value.toFixed(2) : ''
}
