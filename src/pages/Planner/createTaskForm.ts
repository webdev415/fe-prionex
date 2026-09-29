/**
 * Rules of the task / request form without React (planner story 5.7).
 *
 * - The deadline goes as exactly one key (story 3.11): a date without an hour
 *   is `due_date` (`YYYY-MM-DD`, the planner reads it in the board's zone); a
 *   date with an hour and the presets (18:00) are `due_at` — RFC 3339 with the
 *   offset of the zone the person picked the hour in. No deadline is
 *   `due_date: null` (as since 1.10), never both keys.
 * - The board picker: boards of `GET /boards?can_create=true` — `items` are
 *   tasks of a member, `intake` are requests; the search looks at the name,
 *   the department, the code and the П-9 hint.
 * - A 400 of the planner names its field (`details.field`; a board field by
 *   `details.id`, otherwise by its name): it is said at that field.
 */
import type {
  PlannerBoard,
  PlannerBoardField,
  PlannerBoardList,
  PlannerPerson,
  PlannerTaskCreate,
} from '@/api/planner/plannerApi'

// ─── deadline ────────────────────────────────────────────────────────────────

export type DuePreset = 'today' | 'tomorrow' | 'friday'
export const DUE_PRESETS: readonly DuePreset[] = ['today', 'tomorrow', 'friday']
/** The hour of every preset (UX-DR24, SHT-03 of HUB: «Сьогодні 18:00 · Завтра · Пт»). */
export const DUE_PRESET_TIME = '18:00'

/** A deadline as the person set it: a calendar date and, optionally, an hour. */
export interface DueChoice {
  /** `YYYY-MM-DD`, or '' while «Обрати дату» has no date yet. */
  date: string
  /** `HH:MM`, or '' — a date without an hour. */
  time: string
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{2}):(\d{2})$/

/** Wall clock of an instant in a zone (the browser's when none), as a UTC number. */
function wallClock(instant: number, timeZone: string | undefined): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value)
  return Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second')
  )
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

function isoDate(utc: number): string {
  const d = new Date(utc)
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Today's calendar date in the zone. */
export function todayIn(now: Date, timeZone?: string): string {
  return isoDate(wallClock(now.getTime(), timeZone))
}

function dateUtc(date: string): number | null {
  const m = DATE_RE.exec(date)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const utc = Date.UTC(y, mo - 1, d)
  const back = new Date(utc)
  // 31.02 is not a date: `Date.UTC` would roll it over to March.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return null
  }
  return utc
}

/**
 * The preset's date and hour: today, tomorrow, or the next Friday after today
 * (on a Friday that is the Friday of next week — today is «Сьогодні»), at 18:00.
 */
export function presetChoice(preset: DuePreset, now: Date, timeZone?: string): DueChoice {
  const today = dateUtc(todayIn(now, timeZone)) as number
  const weekday = new Date(today).getUTCDay()
  const ahead = preset === 'today' ? 0 : preset === 'tomorrow' ? 1 : (5 - weekday + 7) % 7 || 7
  return { date: isoDate(today + ahead * 86_400_000), time: DUE_PRESET_TIME }
}

/**
 * A wall-clock date and hour in the zone → RFC 3339 with that zone's offset at
 * that moment (`2026-10-02T18:00:00+03:00`). `null` when the hour does not
 * exist that day (the spring-forward gap) — the form says so instead of
 * sending a moment an hour off.
 */
export function zonedMoment(date: string, time: string, timeZone?: string): string | null {
  const day = dateUtc(date)
  const hm = TIME_RE.exec(time)
  if (day === null || !hm) return null
  const [h, mi] = [Number(hm[1]), Number(hm[2])]
  if (h > 23 || mi > 59) return null
  const wall = day + (h * 60 + mi) * 60_000
  let offset = wallClock(wall, timeZone) - wall
  let instant = wall - offset
  const second = wallClock(instant, timeZone) - instant
  if (second !== offset) {
    offset = second
    instant = wall - offset
  }
  if (wallClock(instant, timeZone) !== wall) return null
  const minutes = Math.round(offset / 60_000)
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${date}T${time}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

export type DueBody = Pick<PlannerTaskCreate, 'due_date' | 'due_at'>
export type DueProblem = 'dateMissing' | 'invalidDate' | 'nonexistentTime'

/** The deadline as exactly one key of the body, or why it cannot be sent. */
export function dueBody(
  choice: DueChoice | null,
  timeZone?: string
): { body: DueBody } | { problem: DueProblem } {
  if (!choice || (!choice.date && !choice.time)) return { body: { due_date: null } }
  if (!choice.date) return { problem: 'dateMissing' }
  if (dateUtc(choice.date) === null) return { problem: 'invalidDate' }
  if (!choice.time) return { body: { due_date: choice.date } }
  const at = zonedMoment(choice.date, choice.time, timeZone)
  return at ? { body: { due_at: at } } : { problem: 'nonexistentTime' }
}

// ─── board picker ────────────────────────────────────────────────────────────

export type BoardGroup = 'department' | 'team' | 'personal' | 'intakeDepartment' | 'intakeTeam'
/** Member boards by kind, then the request boards: departments before teams. */
export const BOARD_GROUPS: readonly BoardGroup[] = [
  'department',
  'team',
  'personal',
  'intakeDepartment',
  'intakeTeam',
]

export interface BoardOption {
  code: string
  name: string
  group: BoardGroup
  /** The actor's task here is a request (the board is in `intake`). */
  request: boolean
  department: string | null
  hint: string | null
}

/**
 * Options of the «Дошка» / «Кому» field. `requestOnly` is the «Нова заявка»
 * entry: only boards that take requests.
 */
export function boardOptions(
  list: PlannerBoardList | undefined,
  requestOnly = false
): BoardOption[] {
  if (!list) return []
  const members: BoardOption[] = requestOnly
    ? []
    : list.items.map((board) => ({
        code: board.code,
        name: board.name,
        group: board.kind,
        request: false,
        department: null,
        hint: null,
      }))
  const intake: BoardOption[] = (list.intake ?? []).map((board) => ({
    code: board.code,
    name: board.name,
    group: board.kind === 'department' ? 'intakeDepartment' : 'intakeTeam',
    request: true,
    department: board.department_name,
    hint: board.intake_hint,
  }))
  return [...members, ...intake]
}

/** The name a request board is known by: its department, else the board's own name. */
export function requestTargetName(option: Pick<BoardOption, 'department' | 'name'>): string {
  return option.department ?? option.name
}

/** Search by name, department, code and hint; case and edge spaces do not matter. */
export function matchesBoard(option: BoardOption, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('uk')
  if (!needle) return true
  return [option.name, option.department, option.code, option.hint].some(
    (text) => typeof text === 'string' && text.toLocaleLowerCase('uk').includes(needle)
  )
}

// ─── board fields ────────────────────────────────────────────────────────────

/**
 * What a board field holds while the form is open: text for text, date, link,
 * a number as typed and a single choice; ids for a multiple choice; a person.
 */
export type FieldDraft = string | string[] | PlannerPerson | null

type BoardMember = PlannerBoard['members'][number]

/** A board member as the people picker shows them (the board card has no departments). */
export function memberAsPerson(member: BoardMember): PlannerPerson {
  return {
    user_id: member.user_id,
    crm_user_id: member.crm_user_id,
    full_name: member.full_name ?? `#${member.crm_user_id}`,
    never_logged_in: false,
    departments: [],
  }
}

/** The field's default as the form shows it (a person — only if the board names them). */
export function fieldDefaultDraft(
  field: PlannerBoardField,
  members: readonly BoardMember[]
): FieldDraft {
  const value = field.default
  switch (field.type) {
    case 'number':
      return typeof value === 'number' ? String(value) : ''
    case 'multi_select':
      return Array.isArray(value) ? value : []
    case 'person': {
      const member = members.find((m) => m.user_id === value)
      return member ? memberAsPerson(member) : null
    }
    default:
      return typeof value === 'string' ? value : ''
  }
}

/** The value of `TaskCreate.fields` for a touched field; `undefined` — not a number. */
export function fieldBodyValue(
  field: PlannerBoardField,
  draft: FieldDraft
): string | number | string[] | null | undefined {
  if (draft === null) return null
  if (field.type === 'person')
    return typeof draft === 'object' && 'user_id' in draft ? draft.user_id : null
  if (Array.isArray(draft)) return draft.length > 0 ? draft : null
  if (typeof draft !== 'string') return null
  if (draft.trim() === '') return null
  if (field.type === 'number') {
    const number = Number(draft)
    return Number.isFinite(number) ? number : undefined
  }
  return draft
}

// ─── server errors at their fields ───────────────────────────────────────────

export type FormFieldKey =
  | 'board'
  | 'title'
  | 'description'
  | 'type'
  | 'assignees'
  | 'priority'
  | 'due'
  | 'labels'
  | 'watchers'
  | 'attachments'
  | `field:${string}`

const CONTRACT_FIELDS: Record<string, FormFieldKey> = {
  title: 'title',
  description: 'description',
  assignee_ids: 'assignees',
  type_id: 'type',
  priority_id: 'priority',
  due_date: 'due',
  due_at: 'due',
  label_ids: 'labels',
  watcher_ids: 'watchers',
}

/** The form field a 400 names: a key of the body, or a board field by id or name. */
export function fieldOfError(
  details: Record<string, unknown>,
  boardFields: readonly PlannerBoardField[]
): FormFieldKey | undefined {
  const field = details.field
  if (typeof field !== 'string') return undefined
  if (field in CONTRACT_FIELDS) return CONTRACT_FIELDS[field]
  const byId = typeof details.id === 'string' && boardFields.find((f) => f.id === details.id)
  const found = byId || boardFields.find((f) => f.name === field)
  return found ? `field:${found.id}` : undefined
}

/** Dictionary key of the text said at the field. */
export function fieldErrorKey(details: Record<string, unknown>, key: FormFieldKey): string {
  switch (details.reason) {
    case 'required':
      return 'create.errors.required'
    case 'triage_only':
      return 'create.errors.triageOnly'
    case 'raw_html':
      return 'create.errors.rawHtml'
    case 'personal_board_owner_only':
      return 'create.errors.personalOwnerOnly'
  }
  if (key === 'assignees') return 'create.errors.assignees'
  if (key === 'watchers') return 'create.errors.watchers'
  return 'create.errors.invalid'
}
