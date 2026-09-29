/**
 * Draft of a board's configuration in the settings editor (planner story 5.10).
 *
 * The editor keeps the configuration in the shape of the request body of
 * `PUT /boards/{code}/config` (`BoardConfigInput`): the order of an array is
 * the order on the board (the body has no `position`), new elements carry a
 * UUID made here so the same request can point at them (an initial status, a
 * move target). The board card is turned into that shape once; «dirty» is the
 * draft differing from the card it was made from.
 *
 * Nothing here decides a rule: what is valid, what is in use and what may be
 * removed is the server's answer (`dry_run`). This module only puts the
 * server's errors back on the rows they name — `config.<section>[i]…` points
 * at the i-th element of the body that was sent.
 */
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { boardPath } from '../plannerFormat'
import {
  newIdempotencyKey,
  type PlannerBoard,
  type PlannerBoardConfig,
  type PlannerBoardConfigError,
  type PlannerBoardConfigInput,
  type PlannerBoardConfigPut,
} from '@/api/planner/plannerApi'

export type ConfigInput = PlannerBoardConfigInput
export type StatusInput = ConfigInput['statuses'][number]
export type TaskTypeInput = ConfigInput['task_types'][number]
export type FieldInput = ConfigInput['fields'][number]
export type FieldType = FieldInput['type']
export type LabelInput = ConfigInput['labels'][number]
export type PriorityInput = ConfigInput['priorities'][number]
export type DefaultsInput = ConfigInput['defaults']

/** Sections of the editor, in the order of the menu; they are also the address. */
export const SETTINGS_SECTIONS = [
  'general',
  'statuses',
  'types',
  'fields',
  'labels',
  'priorities',
  'defaults',
  'members',
  'access',
  'history',
] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

/** Address of a section of a board's settings (UX C-08 `…/boards/:code/settings/:section`). */
export function boardSettingsPath(code: string, section: SettingsSection): string {
  return `${boardPath(code)}/settings/${section}`
}

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value ?? '')
}

/** What every section editing the configuration gets from the page. */
export interface ConfigSectionProps {
  /** The draft. */
  config: ConfigInput
  /** The configuration as the card has it (a saved field's type is locked, SLA mode warns on change). */
  saved: ConfigInput
  board: PlannerBoard
  /** The server's errors of the last check, on their rows. */
  errors: LocatedError[]
  onChange: (change: (config: ConfigInput) => ConfigInput) => void
}

export interface ConfigDraft {
  config: ConfigInput
  /** Removed status → the status its tasks go to (`move_tasks_to`). */
  moves: Record<string, string>
}

/**
 * A UUID for a new status, type, field, value, label or level. The contract
 * wants the client's UUID for a new element; the generator is the one the
 * section already uses for command keys (`crypto.randomUUID` or its fallback
 * outside a secure context).
 */
export function newElementId(): string {
  return newIdempotencyKey()
}

export const LIST_FIELD_TYPES: readonly FieldType[] = ['single_select', 'multi_select']

export function isListField(type: FieldType): boolean {
  return LIST_FIELD_TYPES.includes(type)
}

function byPosition<T extends { position: number }>(items: T[] | undefined): T[] {
  return [...(items ?? [])].sort((a, b) => a.position - b.position)
}

/** The board card's configuration as the body of `PUT /config` (policy is not part of it). */
export function toConfigInput(config: PlannerBoardConfig): ConfigInput {
  return {
    statuses: byPosition(config.statuses).map((status) => ({
      id: status.id,
      name: status.name,
      category: status.category,
      sla_mode: status.sla_mode,
      default: status.default,
      notify_author: status.notify_author,
      requires_reason: status.requires_reason,
    })),
    task_types: byPosition(config.task_types).map((type) => ({
      id: type.id,
      name: type.name,
      default: type.default,
      sla: type.sla ? { ...type.sla } : null,
      initial_status_id: type.initial_status_id ?? null,
      default_assignee_id: type.default_assignee_id ?? null,
    })),
    fields: byPosition(config.fields).map((field) => {
      const input: FieldInput = {
        id: field.id,
        name: field.name,
        type: field.type,
        required: field.required,
        default: Array.isArray(field.default) ? [...field.default] : (field.default ?? null),
      }
      if (isListField(field.type)) {
        input.options = byPosition(field.options).map((option) => ({
          id: option.id,
          label: option.label,
        }))
      }
      return input
    }),
    labels: byPosition(config.labels).map((label) => ({ id: label.id, name: label.name })),
    priorities: byPosition(config.priorities).map((level) => ({
      id: level.id,
      name: level.name,
      default: level.default,
    })),
    defaults: {
      assignee_id: config.defaults?.assignee_id ?? null,
      checklist: [...(config.defaults?.checklist ?? [])],
      description_template: config.defaults?.description_template ?? null,
    },
  }
}

export function draftFromConfig(config: PlannerBoardConfig): ConfigDraft {
  return { config: toConfigInput(config), moves: {} }
}

/** Same configuration, element by element and in the same order. */
export function sameConfig(a: ConfigInput, b: ConfigInput): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Tasks of the removed status `from` go to `to`. A status whose tasks were
 * going to `from` follows them to `to`: `from` leaves the board too, and a move
 * into it would be refused (`invalid_target`, 5.10 bot round 1).
 */
export function withMove(
  moves: Record<string, string>,
  from: string,
  to: string
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const [removed, target] of Object.entries(moves)) {
    next[removed] = target === from ? to : target
  }
  next[from] = to
  return next
}

/** The moves without those of the statuses `from`. */
export function withoutMoves(
  moves: Record<string, string>,
  from: readonly string[]
): Record<string, string> {
  return Object.fromEntries(Object.entries(moves).filter(([removed]) => !from.includes(removed)))
}

/** Refusals of a chosen move (`move_tasks_to.<id>`): the place has to be chosen again. */
export const MOVE_TARGET_REFUSALS: readonly string[] = ['invalid_target', 'target_requires_reason']

/** The body of `PUT /config`: moves only for statuses the draft no longer has. */
export function requestBody(draft: ConfigDraft): PlannerBoardConfigPut {
  const kept = new Set(draft.config.statuses.map((status) => status.id))
  const moves = Object.entries(draft.moves).filter(([from]) => !kept.has(from))
  return moves.length > 0
    ? { config: draft.config, move_tasks_to: Object.fromEntries(moves) }
    : { config: draft.config }
}

/** Move one element of a list one place up (−1) or down (+1); out of range — unchanged. */
export function moveItem<T>(items: T[], index: number, step: -1 | 1): T[] {
  const target = index + step
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** Put the element at `from` where `to` stands (drag and drop). */
export function reorderItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

// ─── server errors on their rows ───────────────────────────────────────────

/** Section of the body → section of the editor. */
const SECTION_OF_BODY: Record<string, SettingsSection> = {
  statuses: 'statuses',
  task_types: 'types',
  fields: 'fields',
  labels: 'labels',
  priorities: 'priorities',
  defaults: 'defaults',
}

export interface LocatedError {
  /** Editor section; null — the whole configuration (`config`, `config_too_large`). */
  section: SettingsSection | null
  /** The row (status, type, field, label, level) the error is about. */
  rowId: string | null
  /** A value of a list field. */
  optionId: string | null
  /** What in the row: `name`, `category`, `sla`, `options`, `checklist`, … */
  key: string | null
  reason: string
  usedCount: number | undefined
  /** The element the server named (`details.id`), e.g. a removed status. */
  id: string | undefined
}

const PATH = /^config\.(\w+)(?:\[(\d+)\])?(?:\.(.+))?$/
const OPTION_PATH = /^options\[(\d+)\](?:\.(\w+))?$/

/**
 * Put a `BoardConfigError` on its row. The index in the path is the index in
 * the body that was sent — the same draft, so the same element.
 */
export function locateError(error: PlannerBoardConfigError, sent: ConfigInput): LocatedError {
  const located: LocatedError = {
    section: null,
    rowId: null,
    optionId: null,
    key: null,
    reason: error.reason,
    usedCount: error.used_count,
    id: error.id,
  }
  if (error.field === 'move_tasks_to' || error.field.startsWith('move_tasks_to.')) {
    // `move_tasks_to.<id>` (`invalid_target`, …) names the removed status in its path.
    const named = error.field.slice('move_tasks_to.'.length)
    return {
      ...located,
      section: 'statuses',
      key: 'move_tasks_to',
      id: error.id ?? (named === '' ? undefined : named),
    }
  }
  const match = PATH.exec(error.field)
  if (!match) return located
  const [, part, index, rest] = match
  const section = SECTION_OF_BODY[part] ?? null
  located.section = section
  if (part === 'defaults') {
    located.key = rest ? rest.replace(/\[\d+\]$/, '') : null
    return located
  }
  const rows = (sent as unknown as Record<string, { id: string }[] | undefined>)[part]
  const row = index !== undefined ? rows?.[Number(index)] : undefined
  // `config.task_types` + `type_in_use` names its element by id, not by index
  // (it is the one the draft dropped).
  located.rowId = row?.id ?? (index === undefined && error.id ? error.id : null)
  // The whole row (`config.statuses[2]`) or the whole section
  // (`config.priorities`, `priority_count`) — no key within it.
  if (!rest) return located
  const option = OPTION_PATH.exec(rest)
  if (option && part === 'fields') {
    const field = row as FieldInput | undefined
    located.optionId = field?.options?.[Number(option[1])]?.id ?? null
    located.key = option[2] ?? 'options'
    return located
  }
  located.key = rest.split(/[.[]/)[0]
  // `option_in_use` comes as `config.fields[i].options` and names the value by id.
  if (located.key === 'options' && error.id) located.optionId = error.id
  return located
}

export function locateErrors(errors: PlannerBoardConfigError[], sent: ConfigInput): LocatedError[] {
  return errors.map((error) => locateError(error, sent))
}

/** Sections whose elements tasks hold (`type_in_use`, `label_in_use`, `priority_in_use`). */
const HELD_BY_TASKS: Partial<Record<SettingsSection, 'task_types' | 'labels' | 'priorities'>> = {
  types: 'task_types',
  labels: 'labels',
  priorities: 'priorities',
}

function putBack<T extends { id: string }>(items: T[], saved: T[], id: string): T[] {
  if (items.some((item) => item.id === id)) return items
  const index = saved.findIndex((item) => item.id === id)
  if (index < 0) return items
  const next = [...items]
  next.splice(Math.min(index, next.length), 0, saved[index])
  return next
}

/**
 * The elements the server refused to drop (`*_in_use`, `intake_default_type_in_use`)
 * go back into the draft where they stood, so the error has a row to stand on:
 * a type, a label, a level, a value of a list field.
 */
export function restoreUsed(
  config: ConfigInput,
  saved: ConfigInput,
  errors: LocatedError[]
): ConfigInput {
  let next = config
  for (const error of errors) {
    if (!error.reason.endsWith('_in_use') || !error.id) continue
    const part = error.section ? HELD_BY_TASKS[error.section] : undefined
    if (part === 'task_types')
      next = { ...next, task_types: putBack(next.task_types, saved.task_types, error.id) }
    if (part === 'labels') next = { ...next, labels: putBack(next.labels, saved.labels, error.id) }
    if (part === 'priorities') {
      next = { ...next, priorities: putBack(next.priorities, saved.priorities, error.id) }
    }
    if (error.section === 'fields' && error.reason === 'option_in_use' && error.rowId) {
      const savedField = saved.fields.find((field) => field.id === error.rowId)
      next = {
        ...next,
        fields: next.fields.map((field) =>
          field.id === error.rowId
            ? {
                ...field,
                options: putBack(
                  field.options ?? [],
                  savedField?.options ?? [],
                  error.id as string
                ),
              }
            : field
        ),
      }
    }
  }
  return next
}

export function errorsOfRow(errors: LocatedError[], rowId: string): LocatedError[] {
  return errors.filter((error) => error.rowId === rowId && error.optionId === null)
}

export function errorsOfSection(errors: LocatedError[], section: SettingsSection): LocatedError[] {
  return errors.filter((error) => error.section === section && error.rowId === null)
}

/** Section of the editor → section of the body (the inverse of SECTION_OF_BODY). */
const BODY_OF_SECTION: Partial<Record<SettingsSection, keyof ConfigInput>> = {
  statuses: 'statuses',
  types: 'task_types',
  fields: 'fields',
  labels: 'labels',
  priorities: 'priorities',
  defaults: 'defaults',
}

/** What an error points at in a configuration, as text; undefined — it is not there. */
function pointedAt(error: LocatedError, config: ConfigInput): string | undefined {
  if (error.section === null) return JSON.stringify(config)
  const part = BODY_OF_SECTION[error.section]
  if (!part) return undefined
  if (part === 'defaults') {
    const key = error.key as keyof DefaultsInput | null
    return JSON.stringify(key && key in config.defaults ? config.defaults[key] : config.defaults)
  }
  const rows = config[part] as { id: string }[]
  if (error.rowId === null) return JSON.stringify(rows)
  const row = rows.find((item) => item.id === error.rowId)
  if (!row) return undefined
  if (error.optionId === null) return JSON.stringify(row)
  const option = (row as FieldInput).options?.find((item) => item.id === error.optionId)
  return option ? JSON.stringify(option) : undefined
}

/**
 * The errors of the last check still true of the draft: an error stays while
 * the element it points at (a row, a value, a key of «Виконавець, чек-лист,
 * опис», a whole section) is as it was checked. Editing it — renaming the
 * duplicate, picking a participant — takes the error and its count in the menu
 * away; «Зберегти» asks the server again (5.10 bot round 1).
 */
export function currentErrors(
  errors: LocatedError[],
  checked: ConfigInput,
  draft: ConfigInput
): LocatedError[] {
  return errors.filter((error) => {
    const before = pointedAt(error, checked)
    return before !== undefined && before === pointedAt(error, draft)
  })
}

export function countBySection(errors: LocatedError[]): Map<SettingsSection | null, number> {
  const counts = new Map<SettingsSection | null, number>()
  for (const error of errors) counts.set(error.section, (counts.get(error.section) ?? 0) + 1)
  return counts
}

// ─── numbers in texts ──────────────────────────────────────────────────────

/**
 * The key of a phrase with a number: `…One`, `…Few` or `…Many` by the plural
 * rules of the interface language. The `planner` dictionary keeps strict en/uk
 * parity without i18next plural suffixes (5.1), so the three forms are three
 * ordinary keys; English uses One and Many.
 */
export function pluralKey(base: string, count: number, language: string): string {
  let form: Intl.LDMLPluralRule = 'other'
  try {
    form = new Intl.PluralRules(intlLocaleForUiLanguage(language)).select(count)
  } catch {
    form = count === 1 ? 'one' : 'other'
  }
  if (form === 'one') return `${base}One`
  if (form === 'few') return `${base}Few`
  return `${base}Many`
}
