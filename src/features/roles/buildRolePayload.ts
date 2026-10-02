/**
 * What a role form adds to its request for HUB chat rights: the HUB chat role
 * (KAN-1476) or, behind `VITE_ROLE_CHAT_SETTINGS_ENABLED`, the HUB chat
 * settings (board #1621, story 4). A form uses one pair or the other, never
 * both - see `roleChatSettingsFlag.ts`.
 *
 * The rules, all of which exist to keep a form from changing HUB rights that
 * nobody touched.
 *
 * HUB chat role (flag off):
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
 *   The select's value is a string: `''` stands for "not set".
 *
 * HUB chat settings (flag on):
 * - the forms never send `hub_role`: «Роль у чаті (HUB)» is not in the form,
 *   the chat settings are the switches, the screen and the template;
 * - create sends `chat_template` only when one was picked, and only while the
 *   CURRENT catalogue offers it as assignable (a refetch may drop the pick or
 *   take `assignable` away) - no template is the default, so there is nothing
 *   to send for it;
 * - edit never sends `chat_template` (create only); while the section may be
 *   edited it sends `chat_switches` (all eight) only when they differ from
 *   what GET returned or a role that is not filled is being filled, and
 *   `home_plane` only when it differs from what GET returned - each field on
 *   its own, never one just because the other changed.
 *
 * `stored` must be the role's value as the form renders it NOW, not a copy
 * taken when the form opened: the role detail is refetched under an open form.
 */

import {
  effectiveChatTemplate,
  orderedSwitches,
  sameSwitches,
  type ChatCatalogView,
  type ChatDraft,
} from './chatRoleSet'
import type { HubRoleCatalogStatus, HubRoleLock } from './hubRoles'
import { isAssignableHubRole, isHubRoleNotSet } from './hubRoles'
import type { ChatSwitches, CreateRoleInput, HubRoleOption, UpdateRoleInput } from './types'

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

export function chatTemplateCreatePatch(
  catalog: ChatCatalogView,
  selected: string
): Pick<CreateRoleInput, 'chat_template'> {
  if (catalog.status !== 'ready' || selected === '') return {}
  if (effectiveChatTemplate(selected, catalog.templates) === '') return {}
  return { chat_template: selected }
}

/**
 * "Differs" and not "was touched": under impersonation the API refuses ANY
 * chat key present, a stored value sent back too, so a section changed and
 * changed back must send nothing. Each field goes out only when it differs
 * (the switches also when a role that is not filled is being filled): a value
 * nobody touched is never sent back, because a form that was not refetched
 * would put it over what somebody else saved in the meantime. The API keeps a
 * field whose key is absent.
 */
export function chatUpdatePatch({
  editable,
  stored,
  storedHomePlane,
  draft,
}: {
  editable: boolean
  stored: ChatSwitches | null
  storedHomePlane: string
  draft: ChatDraft | null
}): Pick<UpdateRoleInput, 'chat_switches' | 'home_plane'> {
  if (!editable || draft === null) return {}
  const patch: Pick<UpdateRoleInput, 'chat_switches' | 'home_plane'> = {}
  if (stored === null || !sameSwitches(draft.switches, stored)) {
    patch.chat_switches = orderedSwitches(draft.switches)
  }
  if (draft.homePlane !== storedHomePlane) patch.home_plane = draft.homePlane
  return patch
}
