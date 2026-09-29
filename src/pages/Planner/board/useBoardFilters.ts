/**
 * Filters and view of a board live in the address (planner story 5.3, AC2 and
 * AC4; UX-DR17, UX-DR47, U-28): a link opens the same filtered board.
 *
 * `?q=&assignee=&author=&label=&priority=&type=&field=&value=&overdue=1&mine=1`
 * and `view=board|list`; `task` (the panel) is left alone. The values go to the
 * server as they are — it filters, counts and refuses (400) a malformed one;
 * the client filters nothing.
 *
 * «Мої» and «Виконавець» are one parameter of the server (`assignee_user_id`,
 * sent once): in the address they differ — `mine=1` means «mine» for whoever
 * opens the link, `assignee=<uuid>` one named person — and turning one on
 * turns the other off.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { PlannerBoardFilterParams } from '@/api/planner/plannerApi'

/** Longest search the contract takes (`q`, 400 beyond). */
export const BOARD_SEARCH_MAX = 200

export const FILTER_KEYS = [
  'q',
  'assignee',
  'author',
  'label',
  'priority',
  'type',
  'field',
  'value',
  'overdue',
  'mine',
] as const
export type FilterKey = (typeof FILTER_KEYS)[number]

export interface BoardFilterState {
  q: string
  assignee?: string
  author?: string
  label?: string
  priority?: string
  type?: string
  /** A board field and its value — only both together make a filter. */
  field?: string
  value?: string
  overdue: boolean
  mine: boolean
}

const text = (params: URLSearchParams, key: string) => params.get(key)?.trim() || undefined

export function readFilters(params: URLSearchParams): BoardFilterState {
  const field = text(params, 'field')
  const value = params.get('value') ?? undefined
  const hasField = Boolean(field) && value !== undefined && value !== ''
  return {
    q: params.get('q')?.trim() ?? '',
    assignee: params.get('mine') === '1' ? undefined : text(params, 'assignee'),
    author: text(params, 'author'),
    label: text(params, 'label'),
    priority: text(params, 'priority'),
    type: text(params, 'type'),
    field: hasField ? field : undefined,
    value: hasField ? value : undefined,
    overdue: params.get('overdue') === '1',
    mine: params.get('mine') === '1',
  }
}

export function hasActiveFilters(state: BoardFilterState): boolean {
  return Boolean(
    state.q ||
    state.assignee ||
    state.author ||
    state.label ||
    state.priority ||
    state.type ||
    state.field ||
    state.overdue ||
    state.mine
  )
}

/**
 * The server's parameters. `mine` needs the person's planner `user_id`
 * (`GET /me`); until it is known there is nothing to ask — `null`.
 */
export function toFilterParams(
  state: BoardFilterState,
  meUserId: string | undefined
): PlannerBoardFilterParams | null {
  if (state.mine && !meUserId) return null
  const params: PlannerBoardFilterParams = {}
  const assignee = state.mine ? meUserId : state.assignee
  if (assignee) params.assignee_user_id = assignee
  if (state.author) params.author_user_id = state.author
  if (state.label) params.label_id = state.label
  if (state.priority) params.priority_id = state.priority
  if (state.type) params.type_id = state.type
  if (state.field && state.value !== undefined) {
    params.field_id = state.field
    params.field_value = state.value
  }
  if (state.overdue) params.overdue = 'true'
  if (state.q) params.q = state.q
  return params
}

export type BoardFilterChange = Partial<Record<FilterKey, string | null>>

export function useBoardFilters() {
  const [params, setParams] = useSearchParams()
  const state = readFilters(params)

  /** `null` or `''` removes a key; a search keystroke replaces the entry, a pick adds one. */
  const change = useCallback(
    (changes: BoardFilterChange, { replace = false }: { replace?: boolean } = {}) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === undefined || value === '') next.delete(key)
            else next.set(key, value)
          }
          // «Мої» and «Виконавець» share the server's parameter.
          if (changes.mine) next.delete('assignee')
          if (changes.assignee) next.delete('mine')
          return next
        },
        { replace }
      ),
    [setParams]
  )

  const clearAll = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        for (const key of FILTER_KEYS) next.delete(key)
        return next
      }),
    [setParams]
  )

  return { state, change, clearAll, active: hasActiveFilters(state) }
}

// ─── view ──────────────────────────────────────────────────────────────────

export type BoardView = 'board' | 'list'

/** The width from which the board is a kanban by default (UX-DR47, U-28). */
export const KANBAN_MIN_WIDTH_QUERY = '(min-width: 1024px)'

function subscribeWide(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(KANBAN_MIN_WIDTH_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** A browser without `matchMedia` (and a test runner) counts as wide. */
function isWide() {
  return (
    typeof window.matchMedia !== 'function' || window.matchMedia(KANBAN_MIN_WIDTH_QUERY).matches
  )
}

/**
 * `?view=board|list`; without it the width decides — below 1024 px a board opens
 * as a list. A choice made in the switcher is written into the address.
 */
export function useBoardView(): [BoardView, (view: BoardView) => void] {
  const [params, setParams] = useSearchParams()
  const wide = useSyncExternalStore(subscribeWide, isWide, () => true)
  const asked = params.get('view')
  const view: BoardView = asked === 'list' || asked === 'board' ? asked : wide ? 'board' : 'list'
  const setView = useCallback(
    (next: BoardView) =>
      setParams((prev) => {
        const out = new URLSearchParams(prev)
        out.set('view', next)
        return out
      }),
    [setParams]
  )
  return [view, setView]
}

/** The same address in the «список» view (the «ще N» and «Усі закриті →» links). */
export function listViewSearch(search: string): string {
  const next = new URLSearchParams(search)
  next.set('view', 'list')
  next.delete('task')
  return `?${next.toString()}`
}
