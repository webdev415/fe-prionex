/**
 * What a role form adds to its request for the HUB chat role (KAN-1476).
 *
 * The rules, all of which exist to keep a form from changing HUB rights that
 * nobody touched:
 * - the key is added only while the catalogue is `enabled`. With the choice
 *   switched off, not yet loaded or unreachable, the key is never sent - not
 *   even as `null`, which the backend would read as "clear it";
 * - create sends a value only when one was picked; "not set" is the default,
 *   so there is nothing to send for it;
 * - edit sends the value only when it differs from the stored one, and an
 *   explicit `null` only when somebody cleared a stored value;
 * - a locked value (a default role, or one the caller may not grant) is never
 *   sent;
 * - a code is sent only while the CURRENT catalogue offers it as assignable.
 *   The forms show the value `effectiveHubRoleValue` derives, so this should
 *   never bite; it is here so that no caller can send a code the screen does
 *   not show as a choice (a refetch dropped it, or took `assignable` away).
 *
 * `stored` must be the role's value as the form renders it NOW, not a copy
 * taken when the form opened: the role detail is refetched under an open form.
 *
 * The select's value is a string: `''` stands for "not set".
 */

import type { HubRoleCatalogStatus, HubRoleLock } from './hubRoles'
import { isAssignableHubRole, isHubRoleNotSet } from './hubRoles'
import type { CreateRoleInput, HubRoleOption, UpdateRoleInput } from './types'

export function hubRoleCreatePatch(
  status: HubRoleCatalogStatus,
  selected: string,
  options: ReadonlyArray<HubRoleOption>
): Pick<CreateRoleInput, 'hub_role'> {
  if (status !== 'enabled' || selected === '') return {}
  if (!isAssignableHubRole(options, selected)) return {}
  return { hub_role: selected }
}

export function hubRoleUpdatePatch({
  status,
  lock,
  stored,
  selected,
  options,
}: {
  status: HubRoleCatalogStatus
  lock: HubRoleLock
  stored: string | null | undefined
  selected: string
  options: ReadonlyArray<HubRoleOption>
}): Pick<UpdateRoleInput, 'hub_role'> {
  if (status !== 'enabled' || lock !== null) return {}
  const before = isHubRoleNotSet(stored) ? '' : (stored as string)
  if (selected === before) return {}
  if (selected === '') return { hub_role: null }
  if (!isAssignableHubRole(options, selected)) return {}
  return { hub_role: selected }
}
