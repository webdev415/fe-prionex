import type { CardHeader } from '../types.card'

/**
 * The name as the card shows it: given name first.
 *
 * The API's ``full_name`` is surname first, and it is what the avatar's
 * monogram and the sort key are built from. The card and the employees list
 * both read given name first, so they compose their own rather than changing
 * the meaning of a field the whole app shares.
 *
 * Falls back to whatever the server sent when a part is missing, so a name
 * never renders as an empty line.
 */
export function displayName(header: Pick<CardHeader, 'first_name' | 'last_name' | 'full_name'>) {
  const parts = [header.first_name, header.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : header.full_name
}
