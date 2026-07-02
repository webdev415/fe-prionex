import type { OperatorUser } from '@/features/users'

/**
 * Employee column label: "Last Name First Name (SIP)", e.g. "Ivanov Ivan (1023)".
 * Falls back to "— (SIP)" when the operator name isn't resolvable.
 */
export function formatEmployeeName(
  op: Pick<OperatorUser, 'first_name' | 'last_name'> | undefined,
  extension: string
): string {
  const name = op ? `${op.last_name ?? ''} ${op.first_name ?? ''}`.trim() : ''
  return `${name || '—'} (${extension})`
}
