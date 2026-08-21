/**
 * One-line summary of an audit event's `details` payload, for the table column.
 *
 * formatDetails() handles a fixed set of entity types and otherwise falls back
 * to `reason`. Events that record an action rather than a field edit — credit
 * lookups, gateway callbacks, exports — carry a request/response payload and no
 * reason, so their Details cell was always an em dash even though the data was
 * there.
 *
 * Values are flattened one level deep and truncated: this feeds a table cell,
 * and the full payload is available in the detail modal.
 */

/** Leaf values worth showing; objects and arrays are skipped as too wide. */
function isScalar(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
  )
}

const MAX_PAIRS = 3
const MAX_VALUE_CHARS = 24

export function summarizeDetails(
  details: Record<string, unknown> | undefined,
  maxPairs: number = MAX_PAIRS
): string {
  if (!details) return ''

  const pairs: string[] = []

  const collect = (source: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(source)) {
      if (pairs.length >= maxPairs) return
      if (isScalar(value)) {
        if (value === '') continue
        const text = String(value)
        pairs.push(
          `${key}: ${text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : text}`
        )
      }
    }
  }

  // Scalars at the top level first, then one level down (request/response
  // wrappers), so the most specific values are not crowded out by nesting.
  collect(details)
  for (const value of Object.values(details)) {
    if (pairs.length >= maxPairs) break
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      collect(value as Record<string, unknown>)
    }
  }

  return pairs.join(' · ')
}
