/**
 * React Query layer of the planner section (planner stories 1.9, 1.10).
 *
 * Epic 1: a change in one client is visible in the others within 30 s —
 * open lists, the board and the task panel poll at least every 30 s and on
 * return to the tab.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useHasPermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'
import {
  getBoard,
  getMeta,
  listBoards,
  listBoardTasks,
  listMyTasks,
  PLANNER_PEOPLE_QUERY_MAX,
  PLANNER_PEOPLE_QUERY_MIN,
  plannerTextLength,
  resolveTask,
  searchPeople,
  type PlannerMeta,
  type PlannerPeopleList,
} from './plannerApi'
import { readPlannerError } from './plannerErrors'
// Board settings (5.10) — a line of its own, so the lanes of the wave merge cleanly.
import { getBoardHistory } from './plannerApi'

export const PLANNER_POLL_MS = 30_000

export const plannerKeys = {
  all: ['planner'] as const,
  meta: () => [...plannerKeys.all, 'meta'] as const,
  boards: () => [...plannerKeys.all, 'boards'] as const,
  board: (code: string) => [...plannerKeys.all, 'board', code] as const,
  boardTasks: (code: string) => [...plannerKeys.all, 'board', code, 'tasks'] as const,
  myTasks: () => [...plannerKeys.all, 'me', 'tasks', 'assigned'] as const,
  task: (key: string) => [...plannerKeys.all, 'task', key] as const,
  people: (q: string) => [...plannerKeys.all, 'people', q] as const,
}

const live = {
  refetchInterval: PLANNER_POLL_MS,
  refetchOnWindowFocus: true,
} as const

/**
 * `GET /meta`, asked only by holders of `planner.access`: everybody else never
 * sees the section, so there is nothing to ask the planner about.
 */
export function usePlannerMeta(enabled: boolean) {
  return useQuery({
    queryKey: plannerKeys.meta(),
    queryFn: getMeta,
    enabled,
    staleTime: PLANNER_POLL_MS,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  })
}

export type PlannerSectionState =
  /** No `planner.access` in the JWT. */
  | { kind: 'no-access' }
  /** `/meta` has not answered yet. */
  | { kind: 'loading' }
  /** `/meta` said `available: false`, or failed, or the planner is not deployed. */
  | { kind: 'unavailable' }
  | { kind: 'available'; meta: PlannerMeta }

/**
 * Is the «Планування» section shown to this person?
 *
 * **Only an explicit `available: true` shows it** (story 1.9 AC4) — the
 * opposite of the credit switch: the planner ships to PROD dark, and until the
 * planner itself says yes the section must not exist. A network error, a 404
 * from a stand without the planner, a 503 — all read as "unavailable", and the
 * rest of the CRM keeps working.
 */
export function usePlannerSection(): PlannerSectionState {
  const hasAccess = useHasPermission(PERMISSIONS.PLANNER.ACCESS)
  const { data, isPending, isError } = usePlannerMeta(hasAccess)
  if (!hasAccess) return { kind: 'no-access' }
  if (isError) return { kind: 'unavailable' }
  if (isPending || !data) return { kind: 'loading' }
  return data.available ? { kind: 'available', meta: data } : { kind: 'unavailable' }
}

export function usePlannerBoards(enabled = true) {
  return useQuery({
    queryKey: plannerKeys.boards(),
    queryFn: listBoards,
    enabled,
    ...live,
  })
}

/**
 * `GET /boards/{code}`. `poll: false` is for observers that only need the
 * board's configuration at hand (the status chip loads it up front so its menu
 * is never empty on the first click) — a list of fifty chips must not add fifty
 * pollers; the board screen itself keeps polling.
 */
export function usePlannerBoard(
  code: string | undefined,
  enabled = true,
  { poll = true }: { poll?: boolean } = {}
) {
  return useQuery({
    queryKey: plannerKeys.board(code ?? ''),
    queryFn: () => getBoard(code as string),
    enabled: enabled && Boolean(code),
    ...live,
    ...(poll ? {} : { refetchInterval: false as const, staleTime: PLANNER_POLL_MS }),
  })
}

export function usePlannerBoardTasks(code: string | undefined) {
  return useQuery({
    queryKey: plannerKeys.boardTasks(code ?? ''),
    queryFn: () => listBoardTasks(code as string),
    enabled: Boolean(code),
    ...live,
  })
}

export function usePlannerMyTasks() {
  return useQuery({
    queryKey: plannerKeys.myTasks(),
    queryFn: listMyTasks,
    ...live,
  })
}

export function usePlannerTask(key: string | null) {
  return useQuery({
    queryKey: plannerKeys.task(key ?? ''),
    queryFn: () => resolveTask(key as string),
    enabled: Boolean(key),
    retry: false,
    ...live,
    // A task that is gone or hidden (404) will not come back by itself: stop
    // polling it, focus still asks again. Any other failure — no network, a 503,
    // a 500 — is passing, and the poll keeps going so the panel recovers alone.
    refetchInterval: (query) =>
      query.state.status === 'error' && readPlannerError(query.state.error).status === 404
        ? false
        : PLANNER_POLL_MS,
  })
}

/**
 * People search needs 2–100 characters after trimming (contract `minLength: 2`,
 * `maxLength: 100`, counted like the planner counts runes): a longer text is
 * not sent at all — it would only earn a 400. The caller debounces the text.
 * While the next answer loads, the previous one is kept only when the new text
 * is itself a search and one text is a prefix of the other — the list does not blink while a name is
 * typed or corrected. A shorter text (the field cleared after a pick, or its
 * first letter) keeps nothing. The next name can briefly show the last
 * search's people only while one text still continues the other, and those
 * people match the new text too.
 */
export function usePlannerPeople(q: string) {
  const query = q.trim()
  const searchable = isPeopleQuery(query)
  return useQuery({
    queryKey: plannerKeys.people(query),
    queryFn: () => searchPeople(query),
    enabled: searchable,
    staleTime: 60_000,
    placeholderData: (previous: PlannerPeopleList | undefined, previousQuery) => {
      const before = previousQuery?.queryKey[2]
      const refining =
        searchable &&
        typeof before === 'string' &&
        (query.startsWith(before) || before.startsWith(query))
      return refining ? keepPreviousData(previous) : undefined
    },
  })
}

/** A trimmed text the people search accepts (2–100 characters). */
export function isPeopleQuery(query: string): boolean {
  const length = plannerTextLength(query)
  return length >= PLANNER_PEOPLE_QUERY_MIN && length <= PLANNER_PEOPLE_QUERY_MAX
}

// ─── board settings (story 5.10) ───────────────────────────────────────────

/** Journal of a board — under the board's key, so re-reading the board re-reads it. */
export const plannerBoardHistoryKey = (code: string) =>
  [...plannerKeys.board(code), 'history'] as const

/** `GET /boards/{code}/history` for the settings section «Історія»; read when opened. */
export function usePlannerBoardHistory(code: string | undefined, enabled = true) {
  return useQuery({
    queryKey: plannerBoardHistoryKey(code ?? ''),
    queryFn: () => getBoardHistory(code as string),
    enabled: enabled && Boolean(code),
    refetchOnWindowFocus: true,
  })
}
