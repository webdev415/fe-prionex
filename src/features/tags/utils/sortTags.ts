/**
 * Sort tags so selected ones appear first while preserving relative order
 * within the selected and unselected groups.
 */
export function sortTagsWithSelectedFirst<T extends { id: number }>(
  tags: T[],
  selectedIds: Iterable<number>
): T[] {
  const selected = new Set(selectedIds)
  const pinned: T[] = []
  const rest: T[] = []
  for (const tag of tags) {
    if (selected.has(tag.id)) {
      pinned.push(tag)
    } else {
      rest.push(tag)
    }
  }
  return [...pinned, ...rest]
}
