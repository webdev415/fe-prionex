/**
 * Initials shown for users with no uploaded photo.
 *
 * The monogram inherits the surrounding theme rather than carrying a colour of
 * its own, so it reads the same in every theme and matches the avatar container
 * it replaces.
 */

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
