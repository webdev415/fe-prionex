// datetime-local wants local "YYYY-MM-DDTHH:mm" (not toISOString → that's UTC).
export function defaultDeadline(daysAhead = 1): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setHours(18, 0, 0, 0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
