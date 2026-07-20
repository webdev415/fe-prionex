/**
 * 3-state tag filter helpers for the client list.
 *
 * Each tag cycles: neutral → include → exclude → neutral.
 * Include tags are ORed; exclude tags are AND-NOTed with the include group.
 */

export type TagFilterTriState = 'neutral' | 'include' | 'exclude'

export interface TagFilterSelection {
  includeIds: number[]
  excludeIds: number[]
}

export function getTagTriState(selection: TagFilterSelection, tagId: number): TagFilterTriState {
  if (selection.includeIds.includes(tagId)) return 'include'
  if (selection.excludeIds.includes(tagId)) return 'exclude'
  return 'neutral'
}

/** Return the next tri-state when a tag is clicked. */
export function cycleTagTriState(selection: TagFilterSelection, tagId: number): TagFilterSelection {
  const state = getTagTriState(selection, tagId)
  if (state === 'neutral') {
    return {
      includeIds: [...selection.includeIds, tagId],
      excludeIds: selection.excludeIds,
    }
  }
  if (state === 'include') {
    return {
      includeIds: selection.includeIds.filter((id) => id !== tagId),
      excludeIds: [...selection.excludeIds, tagId],
    }
  }
  return {
    includeIds: selection.includeIds,
    excludeIds: selection.excludeIds.filter((id) => id !== tagId),
  }
}

export function hasActiveTagFilters(selection: TagFilterSelection): boolean {
  return selection.includeIds.length > 0 || selection.excludeIds.length > 0
}

/** Count as one applied filter when any include or exclude tag is set. */
export function countActiveTagFilter(selection: TagFilterSelection): number {
  return hasActiveTagFilters(selection) ? 1 : 0
}

/** Tag IDs that are include or exclude — used to pin active filters in dropdowns. */
export function getActiveTagFilterIds(selection: TagFilterSelection): number[] {
  return [...selection.includeIds, ...selection.excludeIds]
}
