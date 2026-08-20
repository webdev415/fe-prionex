/**
 * Initials and a stable colour for users with no uploaded photo.
 *
 * The colour is derived from the user id rather than the name, so it survives a
 * rename and two people who share initials still look different. Same id always
 * yields the same swatch, on every device and every session, because nothing is
 * stored and nothing is random.
 */

export const MONOGRAM_PALETTE = [
  { background: '#0F766E', foreground: '#FFFFFF' },
  { background: '#1D4ED8', foreground: '#FFFFFF' },
  { background: '#6D28D9', foreground: '#FFFFFF' },
  { background: '#BE185D', foreground: '#FFFFFF' },
  { background: '#B45309', foreground: '#FFFFFF' },
  { background: '#15803D', foreground: '#FFFFFF' },
  { background: '#0E7490', foreground: '#FFFFFF' },
  { background: '#7C2D12', foreground: '#FFFFFF' },
] as const

export type MonogramSwatch = (typeof MONOGRAM_PALETTE)[number]

function firstLetter(value: string | null | undefined): string {
  if (!value) return ''
  for (const character of Array.from(value.trim())) {
    if (character.trim()) return character.toLocaleUpperCase()
  }
  return ''
}

/**
 * Up to two letters: first name then last name.
 *
 * Falls back to the leading letters of whatever single value is present, so a
 * record with only a username still shows something rather than an empty disc.
 */
export function monogramInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback?: string | null
): string {
  const initials = `${firstLetter(firstName)}${firstLetter(lastName)}`
  if (initials) return initials

  const source = (fallback ?? '').trim()
  if (!source) return ''

  const words = source.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    return `${firstLetter(words[0])}${firstLetter(words[1])}`
  }
  return Array.from(source).slice(0, 2).join('').toLocaleUpperCase()
}

/** Deterministic swatch for a user id. */
export function monogramSwatch(userId: number | null | undefined): MonogramSwatch {
  const id = Number(userId)
  if (!Number.isFinite(id)) return MONOGRAM_PALETTE[0]
  const index = Math.abs(Math.trunc(id)) % MONOGRAM_PALETTE.length
  return MONOGRAM_PALETTE[index]
}
