/**
 * Planner API — thin operation functions over the generated contract types
 * (planner story 1.9, AA-72, AD-40).
 *
 * - Types come from `./schema.ts`, generated from the vendored `./openapi.yaml`
 *   (`npm run planner:types`). No second HTTP client: every call goes through
 *   the shared axios instance of `src/lib/api.ts`, full path `/api/v1/planner/…`,
 *   baseURL = the stand's `VITE_API_BASE_URL`, `withCredentials: true`.
 * - Every request carries `X-Planner-Client: crm` (the planner journals which
 *   client made a change).
 * - `_skipAuthRedirect`: a 401 from the planner means the planner could not
 *   verify the session (its own JWT check), not that the CRM session is gone.
 *   The shared interceptor would sign the user out of the whole CRM over it —
 *   "a planner failure never breaks the CRM" (epic 1). A really expired CRM
 *   session is still caught by the next CRM call.
 */
import type { AxiosRequestConfig } from 'axios'
import api from '@/lib/api'
import type { components, paths } from './schema'

type Schemas = components['schemas']

export type PlannerMeta = Schemas['Meta']
export type PlannerMode = Schemas['Mode']
export type PlannerBoardSummary = Schemas['BoardSummary']
export type PlannerBoardList = Schemas['BoardList']
export type PlannerBoard = Schemas['Board']
export type PlannerBoardStatus = Schemas['BoardStatus']
export type PlannerTaskCard = Schemas['TaskCard']
export type PlannerTaskCardList = Schemas['TaskCardList']
export type PlannerTask = Schemas['Task']
export type PlannerTaskCreate = Schemas['TaskCreate']
export type PlannerTaskPatch = Schemas['TaskPatch']
export type PlannerTaskAction = Schemas['TaskAction']
export type PlannerPerson = Schemas['Person']
export type PlannerPeopleList = Schemas['PeopleList']
export type PlannerErrorBody = Schemas['ErrorBody']

/** Base path of the planner route group in Kong (1.6). */
export const PLANNER_BASE = '/api/v1/planner'
/** Value of `X-Planner-Client` for every CRM call. */
export const PLANNER_CLIENT = 'crm'

/**
 * Text limits of the contract, in runes after trimming the edges (planner
 * `internal/work/domain/task.go`: `MaxTitleRunes`, `MaxDescriptionRunes`,
 * `MaxReasonRunes`). The form reports an overflow; it never cuts the text.
 */
export const PLANNER_TITLE_MAX = 300
export const PLANNER_DESCRIPTION_MAX = 20_000
export const PLANNER_REASON_MAX = 1000

/**
 * Length the way the planner counts it — Unicode code points (Go runes), not
 * UTF-16 units: an emoji is one character, where `String.length` says two.
 */
export function plannerTextLength(text: string): number {
  return Array.from(text).length
}

/** A path of the contract, prefixed with the route-group base. */
type PlannerPath = keyof paths
const url = (path: PlannerPath, params: Record<string, string> = {}): string =>
  PLANNER_BASE +
  path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(params[name] ?? ''))

type PlannerRequestConfig = AxiosRequestConfig & { _skipAuthRedirect?: boolean }

function config(headers: Record<string, string> = {}, extra: AxiosRequestConfig = {}) {
  const cfg: PlannerRequestConfig = {
    ...extra,
    headers: { 'X-Planner-Client': PLANNER_CLIENT, ...headers },
    _skipAuthRedirect: true,
  }
  return cfg
}

/** `ETag` of a single object is its version in quotes (`"3"`) — the If-Match value. */
export function ifMatch(version: number): string {
  return `"${version}"`
}

/**
 * New `Idempotency-Key` for one user action (a form, not a request). The
 * contract requires a UUID. `crypto.randomUUID` exists only in a secure context
 * (HTTPS or localhost), so a stand opened over plain HTTP gets a v4 UUID built
 * from `crypto.getRandomValues`, which has no such restriction.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return uuidV4FromRandomValues()
}

/** RFC 4122 version 4 UUID from 16 random bytes (exported for the test). */
export function uuidV4FromRandomValues(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ─── meta ──────────────────────────────────────────────────────────────────

/** `GET /meta` — whether the section is shown to this person, and the switch position. */
export async function getMeta(): Promise<PlannerMeta> {
  const res = await api.get<PlannerMeta>(url('/meta'), config())
  return res.data
}

// ─── boards ────────────────────────────────────────────────────────────────

/** `GET /boards` — boards where the actor is a participant, by code. */
export async function listBoards(): Promise<PlannerBoardList> {
  const res = await api.get<PlannerBoardList>(url('/boards'), config())
  return res.data
}

/** `GET /boards/{code}` — the board card: config (statuses), members, allowed_actions. */
export async function getBoard(code: string): Promise<PlannerBoard> {
  const res = await api.get<PlannerBoard>(url('/boards/{code}', { code }), config())
  return res.data
}

/** `GET /boards/{code}/tasks` — card projection, ordered by column then position. */
export async function listBoardTasks(code: string): Promise<PlannerTaskCardList> {
  const res = await api.get<PlannerTaskCardList>(
    url('/boards/{code}/tasks', { code }),
    config({}, { params: { limit: 500 } })
  )
  return res.data
}

// ─── tasks ─────────────────────────────────────────────────────────────────

/** `GET /me/tasks?list=assigned` — «Поставлені мені». */
export async function listMyTasks(): Promise<PlannerTaskCardList> {
  const res = await api.get<PlannerTaskCardList>(
    url('/me/tasks'),
    config({}, { params: { list: 'assigned' } })
  )
  return res.data
}

/** `GET /tasks/resolve?key=` — a task by `CODE-n` or UUID (permanent link). */
export async function resolveTask(key: string): Promise<PlannerTask> {
  const res = await api.get<PlannerTask>(url('/tasks/resolve'), config({}, { params: { key } }))
  return res.data
}

/**
 * `POST /boards/{code}/tasks` — create a task. The key belongs to one form
 * submission: a second click on «Створити» sends the same key, so the server
 * replays the first 201 instead of creating a duplicate.
 */
export async function createTask(
  code: string,
  body: PlannerTaskCreate,
  idempotencyKey: string
): Promise<PlannerTask> {
  const res = await api.post<PlannerTask>(
    url('/boards/{code}/tasks', { code }),
    body,
    config({ 'Idempotency-Key': idempotencyKey })
  )
  return res.data
}

/** `PATCH /tasks/{id}` under `If-Match` — the single command for status, order and fields. */
export async function patchTask(
  id: string,
  version: number,
  body: PlannerTaskPatch
): Promise<{ task: PlannerTask; etag: string | undefined }> {
  const res = await api.patch<PlannerTask>(
    url('/tasks/{id}', { id }),
    body,
    config({ 'If-Match': ifMatch(version) })
  )
  const etag = res.headers?.etag
  return { task: res.data, etag: typeof etag === 'string' ? etag : undefined }
}

// ─── people ────────────────────────────────────────────────────────────────

/** `GET /people?q=` — active people of the CRM org mirror, by name substring. */
export async function searchPeople(q: string): Promise<PlannerPeopleList> {
  const res = await api.get<PlannerPeopleList>(url('/people'), config({}, { params: { q } }))
  return res.data
}
