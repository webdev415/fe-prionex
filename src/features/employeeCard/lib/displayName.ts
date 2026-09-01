import type { CardHeader } from '../types.card'

/**
 * The name as the card shows it: given name first.
 *
 * The API's ``full_name`` is surname first - that is how the employees list,
 * the pickers and every other screen read, and it is what the avatar's
 * monogram is built from. The card is the one place that wants it the other
 * way round, so it composes its own rather than changing the meaning of a
 * field the whole app shares.
 *
 * Falls back to whatever the server sent when a part is missing, so a name
 * never renders as an empty line.
 */
export function displayName(header: Pick<CardHeader, 'first_name' | 'last_name' | 'full_name'>) {
  const parts = [header.first_name, header.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : header.full_name
}
