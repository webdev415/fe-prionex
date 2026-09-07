export function safeExternalUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const value = raw.trim()
  if (!value) return undefined
  try {
    const { protocol } = new URL(value, window.location.origin)
    return protocol === 'http:' || protocol === 'https:' ? value : undefined
  } catch {
    return undefined
  }
}
