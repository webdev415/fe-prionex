/**
 * The CRM project scope of the roles admin (CRM-1, KAN-1476).
 *
 * With `AUTH_PROJECT_SCOPE_MODE=enforce` a roles list asked FOR a project the
 * caller holds no `manage_roles` in is refused with 403 PROJECT_SCOPE_DENIED.
 * A list asked without a project is not refused but silently narrowed to the
 * caller's own projects - which is why a screen that offers the roles of one
 * project asks for that project by id: then the refusal is one it can explain.
 *
 * Only this coded refusal is explained on screen. Any other failure of a roles
 * list (the permission check's uncoded 403, a 5xx) is left as quiet as it was
 * before the scope existed.
 */

import { getErrorCode } from '@/lib/errors'

export const PROJECT_SCOPE_DENIED = 'PROJECT_SCOPE_DENIED'

export function isProjectScopeDenied(error: unknown): boolean {
  return getErrorCode(error) === PROJECT_SCOPE_DENIED
}
