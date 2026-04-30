export const HIDDEN_TAG_VISIBILITIES = new Set(['hidden', 'system'])

type VisibilityAwareTag = {
  visibility?: string | null
}

export function isOperatorVisibleTag(tag: VisibilityAwareTag): boolean {
  const visibility = tag.visibility?.toLowerCase()
  if (!visibility) return true
  return !HIDDEN_TAG_VISIBILITIES.has(visibility)
}
