/** Display as first name + last name (not API ``full_name`` which is often last + first). */
export function formatPersonFirstLast(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null
): string {
  const first = (firstName || '').trim()
  const last = (lastName || '').trim()
  if (first && last) return `${first} ${last}`
  if (first) return first
  if (last) return last
  return (fallback || '').trim()
}

export function readInitiatedByUserId(
  row:
    | { initiated_by?: number | string | null; initiatedBy?: number | string | null }
    | null
    | undefined
): number | undefined {
  if (!row) return undefined
  const raw = row.initiated_by ?? row.initiatedBy
  if (raw == null || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function formatLauncherName(
  userId: number | null | undefined,
  operatorNames: Map<number, string>
): string {
  if (userId == null || !Number.isFinite(userId) || userId <= 0) return ''
  return operatorNames.get(userId) || `#${userId}`
}

type OperatorLike = {
  id: number
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
}

export function buildOperatorNamesMap(operators: OperatorLike[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const operator of operators) {
    map.set(
      operator.id,
      formatPersonFirstLast(operator.first_name, operator.last_name, operator.full_name) ||
        `#${operator.id}`
    )
  }
  return map
}
