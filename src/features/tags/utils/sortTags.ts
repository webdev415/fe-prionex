type SortableTag = {
  id: number
  name: string
  sort_order?: number
}

/** Default sort order for tags without an explicit value (migration / legacy). */
export const DEFAULT_TAG_SORT_ORDER = 100

function tagSortOrder(tag: SortableTag): number {
  const value = tag.sort_order
  return typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_TAG_SORT_ORDER
}

/** Compare tags by sort_order asc, then name asc (A→Z). */
export function compareTagsByOrder<T extends SortableTag>(a: T, b: T): number {
  const orderDiff = tagSortOrder(a) - tagSortOrder(b)
  if (orderDiff !== 0) return orderDiff
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

/** Sort tags by global sort order, then alphabetically within ties. */
export function sortTagsByOrder<T extends SortableTag>(tags: T[]): T[] {
  return [...tags].sort(compareTagsByOrder)
}

/**
 * Sort tags so selected ones appear first. Sort order applies within the
 * selected and unselected groups independently.
 */
export function sortTagsWithSelectedFirst<T extends SortableTag>(
  tags: T[],
  selectedIds: Iterable<number>
): T[] {
  const sorted = sortTagsByOrder(tags)
  const selected = new Set(selectedIds)
  const pinned: T[] = []
  const rest: T[] = []
  for (const tag of sorted) {
    if (selected.has(tag.id)) {
      pinned.push(tag)
    } else {
      rest.push(tag)
    }
  }
  return [...pinned, ...rest]
}

/** Entry shape for Related Tags tab (tag + optional linked client tie-break). */
export type RelatedTagSortable = {
  tag: SortableTag
  linkedClientId?: number
}

/** Global sort for Related Tags: tag sort_order/name, then linked client id. */
export function compareRelatedTagEntries(a: RelatedTagSortable, b: RelatedTagSortable): number {
  const byTag = compareTagsByOrder(a.tag, b.tag)
  if (byTag !== 0) return byTag
  return (a.linkedClientId ?? 0) - (b.linkedClientId ?? 0)
}

export function sortRelatedTagEntries<T extends RelatedTagSortable>(entries: T[]): T[] {
  return [...entries].sort(compareRelatedTagEntries)
}
