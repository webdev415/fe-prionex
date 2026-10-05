/**
 * The HUB chat settings of a CRM role in the role form (board #1621, story 4).
 *
 * A role carries its HUB chat permission set as data; the form shows it as
 * eight switches and a home screen, and a new role is copied from a template.
 * Everything about rights is the backend's: the values shown are what GET
 * returned, the set behind them is recomputed by the API from the switches the
 * form sends (`PUT /admin/roles/{id}`), and the values to choose from come
 * from the catalogue (`GET /admin/roles/hub-roles`).
 *
 * What lives here: the names of the codes (one place), reading the API's
 * answers tolerantly, the two switch combinations the API refuses by rule
 * (`switch_conflicts` - mirrored only so a person cannot assemble them), what
 * a save sends, and which form field a refusal belongs to. Labels mirror
 * `accessLevels.ts`: `{ labelKey, fallback }`.
 */

import axios from 'axios'
import { getErrorCode } from '@/lib/errors'
import type { ChatSwitches, ChatTemplateOption, HubRoleCatalog } from './types'

export interface ChatLabel {
  labelKey: string
  fallback: string
}

/** The switches in the backend's form order (`SWITCH_KEYS`). */
export const SWITCH_KEYS = [
  'access',
  'client_dialogs',
  'create_groups',
  'dept_channel_admin',
  'download_files',
  'ai_assistant',
  'chat_only',
  'lead',
] as const satisfies ReadonlyArray<keyof ChatSwitches>

export type SwitchKey = (typeof SWITCH_KEYS)[number]

/** The on/off switches (every switch but the dialogue scope). */
export type ToggleKey = Exclude<SwitchKey, 'client_dialogs'>

export const CLIENT_DIALOGS_NONE = 'none'

/** The backend's DEFAULT_HOME_PLANE - the screen of a role not filled. */
export const DEFAULT_HOME_PLANE = 'my_day'

const SWITCH_LABEL_BASE = 'pages.roles.chat.switches'

export const SWITCH_LABELS: Readonly<Record<SwitchKey, ChatLabel & { hint: ChatLabel }>> = {
  access: {
    labelKey: `${SWITCH_LABEL_BASE}.access.label`,
    fallback: 'Chat access',
    hint: {
      labelKey: `${SWITCH_LABEL_BASE}.access.hint`,
      fallback: 'Off: people with this role have no chat and no auto-channels.',
    },
  },
  client_dialogs: {
    labelKey: `${SWITCH_LABEL_BASE}.client_dialogs.label`,
    fallback: 'Client dialogues',
    hint: {
      labelKey: `${SWITCH_LABEL_BASE}.client_dialogs.hint`,
      fallback: 'Whose client dialogues are visible: none, own, department or all.',
    },
  },
  create_groups: {
    labelKey: `${SWITCH_LABEL_BASE}.create_groups.label`,
    fallback: 'Create groups',
    hint: {
      labelKey: `${SWITCH_LABEL_BASE}.create_groups.hint`,
      fallback: 'Create group chats and forward messages.',
    },
  },
  dept_channel_admin: {
    labelKey: `${SWITCH_LABEL_BASE}.dept_channel_admin.label`,
    fallback: 'Department channel admin',
    hint: {
      labelKey: `${SWITCH_LABEL_BASE}.dept_channel_admin.hint`,
      fallback: 'Administers the auto-channels of its department and its groups.',
    },
  },
  download_files: {
    labelKey: `${SWITCH_LABEL_BASE}.download_files.label`,
    fallback: 'Download files',
    hint: {
      labelKey: `${SWITCH_LABEL_BASE}.download_files.hint`,
      fallback: 'Download files from the chat.',
    },
  },
  ai_assistant: {
    labelKey: `${SWITCH_LABEL_BASE}.ai_assistant.label`,
    fallback: 'AI assistant',
    hint: {
      labelKey: `${SWITCH_LABEL_BASE}.ai_assistant.hint`,
      fallback: 'Use the AI assistant (in client dialogues too, while those are on).',
    },
  },
  chat_only: {
    labelKey: `${SWITCH_LABEL_BASE}.chat_only.label`,
    fallback: 'Chat only (bot)',
    hint: {
      labelKey: `${SWITCH_LABEL_BASE}.chat_only.hint`,
      fallback: 'A bot set: channels, messages and files only; no auto-channels.',
    },
  },
  lead: {
    labelKey: `${SWITCH_LABEL_BASE}.lead.label`,
    fallback: 'Lead rights',
    hint: {
      labelKey: `${SWITCH_LABEL_BASE}.lead.hint`,
      fallback: 'Create and archive channels, manage bots, export reports.',
    },
  },
}

const CLIENT_DIALOG_LABELS: Readonly<Record<string, ChatLabel>> = {
  none: { labelKey: 'pages.roles.chat.clientDialogs.none', fallback: 'None' },
  my: { labelKey: 'pages.roles.chat.clientDialogs.my', fallback: 'Own' },
  department: { labelKey: 'pages.roles.chat.clientDialogs.department', fallback: 'Department' },
  all: { labelKey: 'pages.roles.chat.clientDialogs.all', fallback: 'All' },
}

const HOME_PLANE_LABELS: Readonly<Record<string, ChatLabel>> = {
  operator: { labelKey: 'pages.roles.chat.homePlanes.operator', fallback: 'My clients' },
  legal: { labelKey: 'pages.roles.chat.homePlanes.legal', fallback: 'My cases' },
  training: { labelKey: 'pages.roles.chat.homePlanes.training', fallback: 'My groups' },
  quality: { labelKey: 'pages.roles.chat.homePlanes.quality', fallback: 'Review queue' },
  control: { labelKey: 'pages.roles.chat.homePlanes.control', fallback: 'Team control' },
  my_day: { labelKey: 'pages.roles.chat.homePlanes.my_day', fallback: 'My day' },
}

/**
 * The names of the chat templates - the HUB seed roles and "none" - in one
 * place: the owner's words (співробітник / оператор / керівник / адмін /
 * юрист / тренер / бот) plus quality control and "no chat access".
 */
const CHAT_TEMPLATE_LABELS: Readonly<Record<string, ChatLabel>> = {
  employee: { labelKey: 'pages.roles.chat.templates.employee', fallback: 'Employee' },
  operator: { labelKey: 'pages.roles.chat.templates.operator', fallback: 'Operator' },
  supervisor: { labelKey: 'pages.roles.chat.templates.supervisor', fallback: 'Manager' },
  admin: { labelKey: 'pages.roles.chat.templates.admin', fallback: 'Administrator' },
  lawyer: { labelKey: 'pages.roles.chat.templates.lawyer', fallback: 'Lawyer' },
  training_workspace: {
    labelKey: 'pages.roles.chat.templates.training_workspace',
    fallback: 'Trainer',
  },
  ai_agent: { labelKey: 'pages.roles.chat.templates.ai_agent', fallback: 'Bot' },
  quality_workspace: {
    labelKey: 'pages.roles.chat.templates.quality_workspace',
    fallback: 'Quality control',
  },
  none: { labelKey: 'pages.roles.chat.templates.none', fallback: 'No chat access' },
}

/** The codes this UI names - for the locale parity test. */
export const NAMED_CLIENT_DIALOGS = Object.keys(CLIENT_DIALOG_LABELS)
export const NAMED_HOME_PLANES = Object.keys(HOME_PLANE_LABELS)
export const NAMED_CHAT_TEMPLATES = Object.keys(CHAT_TEMPLATE_LABELS)

/** The label of a known code, or null - the caller then shows the code. */
export function clientDialogsLabel(code: string): ChatLabel | null {
  return CLIENT_DIALOG_LABELS[code] ?? null
}

export function homePlaneLabel(code: string): ChatLabel | null {
  return HOME_PLANE_LABELS[code] ?? null
}

export function chatTemplateLabel(code: string): ChatLabel | null {
  return CHAT_TEMPLATE_LABELS[code] ?? null
}

/** What the role list says about `chat_access`. */
export const CHAT_ACCESS_LABELS: Readonly<Record<'yes' | 'no' | 'notFilled', ChatLabel>> = {
  yes: { labelKey: 'pages.roles.chat.list.yes', fallback: 'yes' },
  no: { labelKey: 'pages.roles.chat.list.no', fallback: 'no' },
  notFilled: { labelKey: 'pages.roles.chat.list.notFilled', fallback: '—' },
}

export function chatAccessLabel(value: boolean | null | undefined): ChatLabel {
  if (value === true) return CHAT_ACCESS_LABELS.yes
  if (value === false) return CHAT_ACCESS_LABELS.no
  return CHAT_ACCESS_LABELS.notFilled
}

/**
 * The switches of a role read from the API: the eight keys with values of the
 * right type, or null - "not filled" (the API sends null for that, and for a
 * stored row it cannot show).
 */
export function readChatSwitches(value: unknown): ChatSwitches | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  for (const key of SWITCH_KEYS) {
    const one = record[key]
    if (key === 'client_dialogs' ? typeof one !== 'string' : typeof one !== 'boolean') return null
  }
  return orderedSwitches(record as unknown as ChatSwitches)
}

/**
 * What the role's `chat_switches` says: `notFilled` only for null (or no key
 * from a backend that predates it), `unreadable` for a value that is there
 * but is not the eight switches. The form offers to fill only the first: a
 * fill over an unreadable value would replace a stored set nobody saw.
 */
export type StoredChatSwitches =
  | { kind: 'filled'; switches: ChatSwitches }
  | { kind: 'notFilled' }
  | { kind: 'unreadable' }

export function storedChatSwitches(value: unknown): StoredChatSwitches {
  if (value === null || value === undefined) return { kind: 'notFilled' }
  const switches = readChatSwitches(value)
  return switches ? { kind: 'filled', switches } : { kind: 'unreadable' }
}

/** The eight switches in form order, nothing else. */
export function orderedSwitches(switches: ChatSwitches): ChatSwitches {
  return {
    access: switches.access,
    client_dialogs: switches.client_dialogs,
    create_groups: switches.create_groups,
    dept_channel_admin: switches.dept_channel_admin,
    download_files: switches.download_files,
    ai_assistant: switches.ai_assistant,
    chat_only: switches.chat_only,
    lead: switches.lead,
  }
}

export function sameSwitches(a: ChatSwitches, b: ChatSwitches): boolean {
  return SWITCH_KEYS.every((key) => a[key] === b[key])
}

/** The switches of "no chat access" (the backend's `switches_from_set({})`). */
export const NO_ACCESS_SWITCHES: ChatSwitches = {
  access: false,
  client_dialogs: CLIENT_DIALOGS_NONE,
  create_groups: false,
  dept_channel_admin: false,
  download_files: false,
  ai_assistant: false,
  chat_only: false,
  lead: false,
}

/**
 * What "chat only" demands of the other switches - the backend's
 * `_CHAT_ONLY_DEMANDS`: the bot set has no dialogues, groups, AI or lead keys,
 * does download files, and gets no auto-channels.
 */
const CHAT_ONLY_DEMANDS: Readonly<Omit<ChatSwitches, 'access' | 'chat_only'>> = {
  client_dialogs: CLIENT_DIALOGS_NONE,
  create_groups: false,
  dept_channel_admin: false,
  download_files: true,
  ai_assistant: false,
  lead: false,
}

/**
 * The switches after one of them moved, kept clear of the two combinations
 * the API refuses (CHAT_SWITCHES_CONFLICT): access off turns every other
 * switch off; chat only on sets what it demands. Nothing else is derived.
 */
export function applySwitchChange<K extends SwitchKey>(
  current: ChatSwitches,
  key: K,
  value: ChatSwitches[K]
): ChatSwitches {
  const next: ChatSwitches = { ...current, [key]: value }
  if (!next.access) return { ...NO_ACCESS_SWITCHES }
  if (next.chat_only) return { ...next, ...CHAT_ONLY_DEMANDS }
  return next
}

/** The switches that cannot move while the others hold (see above). */
export function lockedSwitches(switches: ChatSwitches): ReadonlySet<SwitchKey> {
  if (!switches.access) return new Set(SWITCH_KEYS.filter((key) => key !== 'access'))
  if (switches.chat_only) return new Set(Object.keys(CHAT_ONLY_DEMANDS) as SwitchKey[])
  return new Set()
}

/**
 * The chat part of the catalogue:
 * - `loading` - no answer yet (or no project to ask about);
 * - `ready` - the templates, screens and dialogue values are known;
 * - `unavailable` - the request failed, or the backend predates them.
 * Only `ready` lets the form offer a choice; otherwise it shows values only.
 */
export type ChatCatalogStatus = 'loading' | 'ready' | 'unavailable'

export interface ChatCatalogView {
  status: ChatCatalogStatus
  templates: ChatTemplateOption[]
  homePlanes: string[]
  clientDialogValues: string[]
  /** The catalogue refused this caller (403): no right to manage roles here. */
  forbidden?: boolean
}

/** The shape the backend validates every code against (as `hubRoles.ts`). */
const CODE = /^[a-z_]{1,32}$/

function codes(value: unknown): string[] {
  const seen = new Set<string>()
  for (const item of value as unknown[]) {
    if (typeof item === 'string' && CODE.test(item)) seen.add(item)
  }
  return [...seen]
}

function nothing() {
  return { templates: [], homePlanes: [], clientDialogValues: [] }
}

/**
 * Reads the chat lists of the catalogue answer; anything that is not the
 * documented shape is unavailable, a template without a valid code is
 * dropped, one without `assignable: true` is not assignable.
 *
 * - `enabled: false` (no project to ask about) is unavailable, not loading: a
 *   disabled query never settles, and the form would wait without a word;
 * - an answer already received is kept while a refetch fails (TanStack keeps
 *   `data` next to the error): a failed background refetch must not hide - and
 *   silently drop - what somebody set in the form.
 */
export function chatCatalogView(query: {
  isPending: boolean
  isError: boolean
  data: HubRoleCatalog | undefined
  enabled?: boolean
  error?: unknown
}): ChatCatalogView {
  if (query.enabled === false) return { status: 'unavailable', ...nothing() }
  if (query.data === undefined) {
    if (query.isError) {
      const forbidden = axios.isAxiosError(query.error) && query.error.response?.status === 403
      return { status: 'unavailable', ...nothing(), ...(forbidden ? { forbidden } : {}) }
    }
    if (query.isPending) return { status: 'loading', ...nothing() }
  }
  const data: unknown = query.data
  if (!data || typeof data !== 'object') return { status: 'unavailable', ...nothing() }
  const record = data as Record<string, unknown>
  if (
    !Array.isArray(record.chat_templates) ||
    !Array.isArray(record.home_planes) ||
    !Array.isArray(record.client_dialog_values)
  ) {
    return { status: 'unavailable', ...nothing() }
  }
  const seen = new Set<string>()
  const templates: ChatTemplateOption[] = []
  for (const item of record.chat_templates as unknown[]) {
    if (!item || typeof item !== 'object') continue
    const { code, assignable } = item as Record<string, unknown>
    if (typeof code !== 'string' || !CODE.test(code) || seen.has(code)) continue
    seen.add(code)
    templates.push({ code, assignable: assignable === true })
  }
  return {
    status: 'ready',
    templates,
    homePlanes: codes(record.home_planes),
    clientDialogValues: codes(record.client_dialog_values),
  }
}

/**
 * The template the picker shows - and the only one a create may send: the
 * pick while the current catalogue offers it as assignable, else none. The
 * catalogue is refetched under an open form (after a refused save too).
 */
export function effectiveChatTemplate(
  pick: string,
  templates: ReadonlyArray<ChatTemplateOption>
): string {
  return templates.some((one) => one.code === pick && one.assignable) ? pick : ''
}

/** The chat section's values as somebody set them in the form. */
export interface ChatDraft {
  switches: ChatSwitches
  homePlane: string
}

/** The form fields a chat refusal can belong to. */
export type ChatRefusalField = 'chat_switches' | 'home_plane' | 'chat_template'

export type ChatRefusalReason =
  | 'invalid'
  | 'conflict'
  | 'broken'
  | 'homePlaneUnknown'
  | 'templateUnknown'
  | 'templateImmutable'
  | 'templateConflict'
  | 'unknownHubRole'
  | 'adminRequired'
  | 'impersonating'

export interface ChatRefusal {
  code: string
  field: ChatRefusalField
  reason: ChatRefusalReason
  /** Switch keys the refusal names (shown by their labels). */
  switches: SwitchKey[]
  /** Names the refusal gives that are no switch (shown as they are). */
  others: string[]
  /** A value the refusal names back (screen, template), if any. */
  value: string | null
}

const SWITCH_KEY_SET: ReadonlySet<string> = new Set(SWITCH_KEYS)

function errorParams(error: unknown): Record<string, unknown> {
  if (!axios.isAxiosError(error)) return {}
  const data: unknown = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const params = (data as Record<string, unknown>).params
  return params && typeof params === 'object' ? (params as Record<string, unknown>) : {}
}

function names(...values: unknown[]): { switches: SwitchKey[]; others: string[] } {
  const switches: SwitchKey[] = []
  const others: string[] = []
  for (const value of values) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      // Only names: an object would read «[object Object]» at the field.
      if (typeof item !== 'string' && typeof item !== 'number') continue
      const name = String(item)
      if (SWITCH_KEY_SET.has(name)) {
        if (!switches.includes(name as SwitchKey)) switches.push(name as SwitchKey)
      } else if (!others.includes(name)) {
        others.push(name)
      }
    }
  }
  return { switches: SWITCH_KEYS.filter((key) => switches.includes(key)), others }
}

function text(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  return String(value)
}

/** 403 refusals whose `params.field` names the chat field that moved. */
const FIELD_REFUSALS: Readonly<Record<string, ChatRefusalReason>> = {
  HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN: 'adminRequired',
  HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING: 'impersonating',
}

/**
 * Which field of the form a refused save is about, and what to say there -
 * null for a refusal that is not about the chat settings (the form's alert
 * says those). A 403 goes by `params.field`: a chat field is that field,
 * `hub_role` (which the form no longer sends) the chat section; anything else
 * (`name`, no field) is not the chat's.
 */
export function chatRefusal(error: unknown): ChatRefusal | null {
  const code = getErrorCode(error)
  if (code === null) return null
  const params = errorParams(error)
  const none = { switches: [] as SwitchKey[], others: [] as string[], value: null }
  switch (code) {
    case 'CHAT_SWITCHES_INVALID':
      return {
        code,
        field: 'chat_switches',
        reason: 'invalid',
        ...names(params.missing, params.bad_values, params.unknown),
        value: null,
      }
    case 'CHAT_SWITCHES_CONFLICT':
      return {
        code,
        field: 'chat_switches',
        reason: 'conflict',
        ...names(params.conflicts),
        value: null,
      }
    case 'CHAT_SET_BROKEN':
      return {
        code,
        field: 'chat_switches',
        reason: 'broken',
        ...names(params.switches),
        value: null,
      }
    case 'CHAT_SET_UNKNOWN_HUB_ROLE':
      return {
        code,
        field: 'chat_switches',
        reason: 'unknownHubRole',
        ...none,
        value: text(params.hub_role),
      }
    case 'HOME_PLANE_UNKNOWN':
      return {
        code,
        field: 'home_plane',
        reason: 'homePlaneUnknown',
        ...none,
        value: text(params.home_plane),
      }
    case 'CHAT_TEMPLATE_UNKNOWN':
      return {
        code,
        field: 'chat_template',
        reason: 'templateUnknown',
        ...none,
        value: text(params.chat_template),
      }
    case 'CHAT_TEMPLATE_IMMUTABLE':
      return {
        code,
        field: 'chat_template',
        reason: 'templateImmutable',
        ...none,
        value: text(params.chat_template),
      }
    case 'CHAT_TEMPLATE_CONFLICT':
      return {
        code,
        field: 'chat_template',
        reason: 'templateConflict',
        ...none,
        value: text(params.chat_template),
      }
  }
  const reason = FIELD_REFUSALS[code]
  if (!reason) return null
  const field = params.field
  if (field === 'chat_switches' || field === 'home_plane' || field === 'chat_template') {
    return { code, field, reason, ...none }
  }
  if (field === 'hub_role') return { code, field: 'chat_switches', reason, ...none }
  return null
}

/**
 * A refusal after which the section should drop what somebody set in it, so
 * that a retry of the same save goes through with the rest of the role: the
 * caller may not make that chat change at all now (403). A 422 keeps the
 * values, to be corrected.
 */
export function dropsChatDraft(refusal: ChatRefusal | null): boolean {
  return (
    refusal !== null && (refusal.reason === 'adminRequired' || refusal.reason === 'impersonating')
  )
}
