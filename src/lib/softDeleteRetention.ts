/**
 * How long a soft-deleted item has left before the purge job removes it.
 *
 * Both services keep deleted rows for the same window and sweep them daily
 * (SMS_TEMPLATE_RETENTION_DAYS / MESSAGING_DRAFT_RETENTION_DAYS, both 90). The
 * value is not exposed over the API, so it is mirrored here; if it is ever
 * changed server-side this constant has to follow.
 */
export const RETENTION_DAYS = 90

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole days left before purge, or null when the item is not on the clock.
 *
 * A row with no ``deleted_at`` is never purged - the SMS job filters
 * ``deleted_at < cutoff`` and the drafts job does the same - so there is no
 * deadline to show rather than a deadline of zero.
 *
 * Negative results are clamped to 0: the item is past its window and the next
 * daily sweep takes it, so "0" is truthful where a negative number would read
 * as nonsense.
 */
export function daysUntilPurge(
  deletedAt: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!deletedAt) return null
  const deleted = new Date(deletedAt)
  if (Number.isNaN(deleted.getTime())) return null

  const purgeAt = deleted.getTime() + RETENTION_DAYS * MS_PER_DAY
  const remaining = Math.ceil((purgeAt - now.getTime()) / MS_PER_DAY)
  return remaining > 0 ? remaining : 0
}
