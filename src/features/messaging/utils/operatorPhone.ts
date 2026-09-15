export function resolveOperatorPhone(
  operator?: { phone?: string | null; asterisk_extension?: string | null } | null
): string {
  const phone = (operator?.phone || '').trim()
  if (phone) return phone
  return operator?.asterisk_extension ? `ext. ${operator.asterisk_extension}` : ''
}
