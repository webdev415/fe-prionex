/**
 * React Query layer of the planner section (planner stories 1.9, 1.10).
 *
 * Epic 1: a change in one client is visible in the others within 30 s —
 * open lists, the board and the task panel poll at least every 30 s and on
 * return to the tab.
 */
import { useQuery } from '@tanstack/react-query'
import { useHasPermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'
import {
  getBoard,
  getMeta,
  listBoards,
  listBoardTasks,
  listMyTasks,
  resolveTask,
  searchPeople,
  type PlannerMeta,
} from './plannerApi'

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

export function usePlannerBoard(code: string | undefined, enabled = true) {
  return useQuery({
    queryKey: plannerKeys.board(code ?? ''),
    queryFn: () => getBoard(code as string),
    enabled: enabled && Boolean(code),
    ...live,
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
  })
}

/** People search needs at least two characters (contract `minLength: 2`). */
export function usePlannerPeople(q: string) {
  const query = q.trim()
  return useQuery({
    queryKey: plannerKeys.people(query),
    queryFn: () => searchPeople(query),
    enabled: query.length >= 2,
    staleTime: 60_000,
  })
}
