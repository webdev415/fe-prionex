/**
 * HUB chat role of a CRM role (KAN-1476).
 *
 * A CRM role may carry the HUB role its people get in the chat. The value is
 * optional and has three kinds:
 * - not set (`null`) - HUB decides by the CRM role's name, and when the name
 *   is unknown to HUB it grants the minimal rights of an employee;
 * - `'none'` - explicitly no access to HUB;
 * - a HUB role name (`employee`, `operator`, ...).
 *
 * "Not set" is therefore NOT "minimal rights": a role called "Operator" with
 * no value gets operator rights in HUB. The labels below keep the two apart,
 * and `employee` is the one that says "minimal rights".
 *
 * The backend decides which values are offered and which the caller may grant
 * (`GET /admin/roles/hub-roles`); this file only names them and reads that
 * answer. Labels mirror `accessLevels.ts`: `{ value, labelKey, fallback }`.
 */

import { getErrorCode } from '@/lib/errors'
import type { HubRoleCatalog, HubRoleMode, HubRoleOption } from './types'

export const HUB_ROLE_NONE = 'none'
export const HUB_ROLE_ADMIN = 'admin'

/** The shape the backend validates every configured code against. */
const HUB_ROLE_CODE = /^[a-z_]{1,32}$/

export interface HubRoleLabel {
  labelKey: string
  fallback: string
}

export const HUB_ROLE_OPTIONS: ReadonlyArray<{ value: string } & HubRoleLabel> = [
  { value: HUB_ROLE_NONE, labelKey: 'pages.roles.hubRole.options.none', fallback: 'No HUB access' },
  {
    value: 'employee',
    labelKey: 'pages.roles.hubRole.options.employee',
    fallback: 'Employee (minimal rights)',
  },
  {
    value: 'training_workspace',
    labelKey: 'pages.roles.hubRole.options.training_workspace',
    fallback: 'Trainer (training workspace)',
  },
  {
    value: 'quality_workspace',
    labelKey: 'pages.roles.hubRole.options.quality_workspace',
    fallback: 'Quality control (QA workspace)',
  },
  { value: 'lawyer', labelKey: 'pages.roles.hubRole.options.lawyer', fallback: 'Lawyer' },
  { value: 'operator', labelKey: 'pages.roles.hubRole.options.operator', fallback: 'Operator' },
  {
    value: 'supervisor',
    labelKey: 'pages.roles.hubRole.options.supervisor',
    fallback: 'Supervisor',
  },
  {
    value: HUB_ROLE_ADMIN,
    labelKey: 'pages.roles.hubRole.options.admin',
    fallback: 'HUB administrator',
  },
]

/** The empty value: HUB goes by the role name. Never "minimal rights". */
export const HUB_ROLE_NOT_SET: HubRoleLabel = {
  labelKey: 'pages.roles.forms.hubRoleNotSet',
  fallback: 'Not set — by role name',
}

/** The label of a known code, or null for a code this UI has no name for. */
export function hubRoleLabel(code: string): HubRoleLabel | null {
  const option = HUB_ROLE_OPTIONS.find((one) => one.value === code)
  return option ? { labelKey: option.labelKey, fallback: option.fallback } : null
}

/**
 * Whether the backend sends the field at all. A backend that predates it
 * leaves the key out, and then there is nothing to show - not even "not set",
 * which would claim a state the backend never reported.
 */
export function hasHubRoleField(role: object): boolean {
  return 'hub_role' in role
}

/** A stored value that means "not set". */
export function isHubRoleNotSet(code: string | null | undefined): boolean {
  return code === null || code === undefined || code.trim() === ''
}

/**
 * - `loading` - no answer yet (or no project to ask about);
 * - `enabled` - the choice can be offered;
 * - `disabled` - the backend answered that the choice is switched off;
 * - `unavailable` - the request failed or the answer made no sense.
 *
 * Only `enabled` shows the field in a form. Everything else keeps it hidden,
 * and a hidden field never adds `hub_role` to what is sent.
 */
export type HubRoleCatalogStatus = 'loading' | 'enabled' | 'disabled' | 'unavailable'

export interface HubRoleCatalogView {
  status: HubRoleCatalogStatus
  mode: HubRoleMode | null
  /** The offered options; empty unless `status` is `enabled`. */
  options: HubRoleOption[]
}

const MODES: ReadonlySet<string> = new Set(['off', 'emit', 'on'])

/**
 * Reads the catalogue answer the way a tolerant reader should: anything that
 * is not the documented shape counts as unavailable rather than as enabled,
 * and an option without a valid code or an explicit `assignable: true` is
 * dropped or kept non-assignable. The field fails closed.
 */
export function hubRoleCatalogView(query: {
  isPending: boolean
  isError: boolean
  data: HubRoleCatalog | undefined
}): HubRoleCatalogView {
  if (query.isError) return { status: 'unavailable', mode: null, options: [] }
  if (query.isPending) return { status: 'loading', mode: null, options: [] }

  const data: unknown = query.data
  if (!data || typeof data !== 'object') return { status: 'unavailable', mode: null, options: [] }
  const record = data as Record<string, unknown>
  const mode = typeof record.mode === 'string' && MODES.has(record.mode) ? record.mode : null
  if (typeof record.enabled !== 'boolean' || !Array.isArray(record.options)) {
    return { status: 'unavailable', mode: mode as HubRoleMode | null, options: [] }
  }
  if (!record.enabled) {
    return { status: 'disabled', mode: mode as HubRoleMode | null, options: [] }
  }

  const seen = new Set<string>()
  const options: HubRoleOption[] = []
  for (const item of record.options as unknown[]) {
    if (!item || typeof item !== 'object') continue
    const { code, assignable } = item as Record<string, unknown>
    if (typeof code !== 'string' || !HUB_ROLE_CODE.test(code) || seen.has(code)) continue
    seen.add(code)
    options.push({ code, assignable: assignable === true })
  }
  return { status: 'enabled', mode: mode as HubRoleMode | null, options }
}

/** One entry of the select, after the "not set" entry that always heads it. */
export interface HubRoleChoice {
  code: string
  /** Null for a code this UI has no name for - shown as the code itself. */
  label: HubRoleLabel | null
  disabled: boolean
  /** The stored value is not among the offered ones: shown, not selectable. */
  unavailable: boolean
}

/**
 * The catalogue options, plus the stored value when the catalogue no longer
 * offers it. That value stays selected (disabled) until somebody explicitly
 * picks another one, so opening and saving a role never changes it silently.
 */
export function hubRoleChoices(
  options: ReadonlyArray<HubRoleOption>,
  stored: string | null | undefined
): HubRoleChoice[] {
  const choices: HubRoleChoice[] = options.map((option) => ({
    code: option.code,
    label: hubRoleLabel(option.code),
    disabled: !option.assignable,
    unavailable: false,
  }))
  if (!isHubRoleNotSet(stored) && !options.some((option) => option.code === stored)) {
    choices.push({ code: stored as string, label: null, disabled: true, unavailable: true })
  }
  return choices
}

/**
 * Why the stored value cannot be changed here, if it cannot:
 * - `default` - a default role's HUB role is fixed by the system (the backend
 *   refuses with HUB_ROLE_DEFAULT_LOCKED);
 * - `notAssignable` - the catalogue marks the stored value not assignable for
 *   this caller.
 *
 * The second lock reads the catalogue's `assignable`, which the backend sets
 * false in exactly two cases today, and in both it also refuses moving AWAY
 * from the value: `admin` for a caller who is not a HUB admin of the project
 * (the guard covers granting and taking away), and every option while the
 * caller is impersonating. The UI does not tell the two apart and names no
 * reason of its own (the lock notes are neutral).
 *
 * Nothing is locked by the role's NAME. What an unset value means for a role
 * named admin/administrator is the backend's rule (`effective_hub_role`,
 * DESIGN §5.2), and a copy of it here would drift from it (CEO decision 8 is
 * to drop those aliases). A pick the backend refuses for that reason comes
 * back as HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN, said in words, and the form drops
 * the pick (see `isStaleHubCatalogueRefusal`), so a retry saves the rest.
 */
export type HubRoleLock = 'default' | 'notAssignable' | null

export function hubRoleLock(
  options: ReadonlyArray<HubRoleOption>,
  stored: string | null | undefined,
  isDefault: boolean
): HubRoleLock {
  if (isDefault) return 'default'
  if (isHubRoleNotSet(stored)) return null
  const option = options.find((one) => one.code === stored)
  return option && !option.assignable ? 'notAssignable' : null
}

/** Whether the catalogue offers this code to the caller to pick right now. */
export function isAssignableHubRole(options: ReadonlyArray<HubRoleOption>, code: string): boolean {
  return options.some((one) => one.code === code && one.assignable)
}

/**
 * The value the select shows - and therefore the only value a save may send -
 * derived on every render from the CURRENT catalogue. `''` is "not set".
 *
 * `pick` is what somebody chose in this form (`null`: nothing yet). A pick
 * holds only while the catalogue still offers it as assignable. The catalogue
 * is refetched under an open form (after a refused save, on focus, after a
 * minute), and a refetch may drop the picked code or take `assignable` away.
 * A pick kept past that has no enabled option to stand on: the browser then
 * shows the first option («Не задано») while the save would still send the
 * old pick, to be refused again. So such a pick falls back to the stored
 * value, and that is what is both shown and (not) sent. A lock does the same.
 */
export function effectiveHubRoleValue({
  options,
  stored,
  pick,
  lock,
}: {
  options: ReadonlyArray<HubRoleOption>
  stored: string | null | undefined
  pick: string | null
  lock: HubRoleLock
}): string {
  const storedValue = isHubRoleNotSet(stored) ? '' : (stored as string)
  if (lock !== null || pick === null) return storedValue
  if (pick === '') return ''
  return isAssignableHubRole(options, pick) ? pick : storedValue
}

export type HubRoleDisplay =
  | { kind: 'notSet' }
  | { kind: 'known'; code: string; label: HubRoleLabel }
  | { kind: 'raw'; code: string; catalogUnavailable: boolean }

/**
 * How a stored value reads outside a form (role view, roles table).
 *
 * With the catalogue switched off (`disabled`: HUB_ROLE_MODE `off` or `emit`)
 * or unreachable, the code is shown as it is with the note «каталог HUB
 * недоступний» (DESIGN §8). The note says that the catalogue gives this UI no
 * name for the value and no way to choose it - NOT that the value is out of
 * force: in `emit` the stored values do reach HUB, and in `off` they are merely
 * kept. Whether a value is in force in HUB is not something this screen knows.
 */
export function describeHubRole(
  code: string | null | undefined,
  status: HubRoleCatalogStatus
): HubRoleDisplay {
  if (isHubRoleNotSet(code)) return { kind: 'notSet' }
  const value = code as string
  if (status !== 'enabled') {
    return {
      kind: 'raw',
      code: value,
      catalogUnavailable: status === 'disabled' || status === 'unavailable',
    }
  }
  const label = hubRoleLabel(value)
  return label
    ? { kind: 'known', code: value, label }
    : { kind: 'raw', code: value, catalogUnavailable: false }
}

/**
 * Refusals of a role save that are about the HUB chat role value the form
 * sent: the mode was rolled back (HUB_ROLE_DISABLED), the value left the
 * catalogue (HUB_ROLE_UNKNOWN), or the caller may not make that change
 * (HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN - granting admin, or taking it away, the
 * latter also from a role that is admin by its name; and
 * HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING).
 *
 * Such a refusal fails the whole save - permissions included. So on one of
 * them the mutation asks the catalogue again (it is cached for a minute and
 * may be out of date), and the form drops its pick: the select goes back to
 * the stored value, the refusal is said in words, and a retry of the same
 * save goes through without the refused value.
 */
const STALE_CATALOGUE_CODES: ReadonlySet<string> = new Set([
  'HUB_ROLE_DISABLED',
  'HUB_ROLE_UNKNOWN',
  'HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN',
  'HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING',
])

export function isStaleHubCatalogueRefusal(error: unknown): boolean {
  const code = getErrorCode(error)
  return code !== null && STALE_CATALOGUE_CODES.has(code)
}
