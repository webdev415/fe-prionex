import type { TagDefinition } from '../types'

const HIDDEN_VISIBILITY_VALUES = new Set(['hidden', 'system'])

export function isAdminRole(roleName?: string | null): boolean {
  return (roleName || '').trim().toLowerCase() === 'admin'
}

export function isHiddenVisibility(visibility?: string | null): boolean {
  return !!visibility && HIDDEN_VISIBILITY_VALUES.has(visibility.toLowerCase())
}

/** Hides system/hidden visibility tags for non-admins. Protected tags stay visible for all roles. */
export function filterTagsForRole<T extends Pick<TagDefinition, 'visibility'>>(
  tags: T[],
  roleName?: string | null,
  includeHidden = false
): T[] {
  if (includeHidden || isAdminRole(roleName)) {
    return tags
  }
  return tags.filter((tag) => !isHiddenVisibility(tag.visibility))
}
