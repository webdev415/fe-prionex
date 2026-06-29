export type ProtectedTagFields = {
  is_protected?: boolean
  protected_removal_roles?: string[]
  can_remove_protected?: boolean
}

function normalizeRole(role?: string | null): string {
  return (role ?? '').trim().toLowerCase()
}

function roleInProtectedRemovalList(
  userRole: string | null | undefined,
  allowedRoles: string[] | undefined
): boolean {
  if (!userRole || !allowedRoles?.length) {
    return false
  }
  const normalized = normalizeRole(userRole)
  return allowedRoles.some((entry) => normalizeRole(entry) === normalized)
}

/**
 * Whether the user may uncheck / remove this tag from a client.
 * Mirrors tag-service `user_can_remove_protected_tag` (prefer API `can_remove_protected` when present).
 */
export function canRemoveProtectedTag(tag: ProtectedTagFields, userRole?: string | null): boolean {
  if (typeof tag.can_remove_protected === 'boolean') {
    return tag.can_remove_protected
  }
  if (!tag.is_protected) {
    return true
  }
  const allowed = tag.protected_removal_roles ?? []
  if (allowed.length === 0) {
    return false
  }
  return roleInProtectedRemovalList(userRole, allowed)
}
