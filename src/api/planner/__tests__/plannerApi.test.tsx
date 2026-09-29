/**
 * Planner operation functions (planner story 1.9, AC5; 1.10): one HTTP client
 * (the shared axios of `src/lib/api.ts`), full path `/api/v1/planner/…`,
 * `X-Planner-Client: crm`, `If-Match` / `Idempotency-Key` where the contract
 * asks, and a planner 401 must not sign the user out of the CRM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AxiosError, AxiosHeaders } from 'axios'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: http, api: http }
})

import {
  createTask,
  getBoardKanban,
  getMe,
  getMeta,
  ifMatch,
  listBoardTasks,
  listMyTasks,
  newIdempotencyKey,
  patchTask,
  resolveTask,
  searchPeople,
  uuidV4FromRandomValues,
} from '../plannerApi'
import {
  PLANNER_POLL_MS,
  plannerKeys,
  usePlannerBoardKanban,
  usePlannerBoardTasks,
  usePlannerMyTasks,
  usePlannerPeople,
  usePlannerTask,
} from '../plannerQueries'
import { readPlannerError } from '../plannerErrors'

const CRM = { 'X-Planner-Client': 'crm' }

describe('planner operations over the shared axios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    http.get.mockResolvedValue({ data: { ok: true }, headers: {} })
    http.post.mockResolvedValue({ data: { key: 'SKL-2' }, headers: {} })
    http.patch.mockResolvedValue({ data: { version: 4 }, headers: { etag: '"4"' } })
  })

  it('GET /meta — full path, X-Planner-Client: crm, no CRM sign-out on a planner 401', async () => {
    await getMeta()
    expect(http.get).toHaveBeenCalledWith('/api/v1/planner/meta', {
      headers: CRM,
      _skipAuthRedirect: true,
    })
  })

  it('lists and reads carry the contract query parameters', async () => {
    await listMyTasks()
    expect(http.get).toHaveBeenLastCalledWith('/api/v1/planner/me/tasks', {
      params: { list: 'assigned' },
      headers: CRM,
      _skipAuthRedirect: true,
    })
    await listBoardTasks('SKL')
    expect(http.get).toHaveBeenLastCalledWith('/api/v1/planner/boards/SKL/tasks', {
      params: { limit: 500 },
      headers: CRM,
      _skipAuthRedirect: true,
    })
    await resolveTask('SKL-2')
    expect(http.get).toHaveBeenLastCalledWith('/api/v1/planner/tasks/resolve', {
      params: { key: 'SKL-2' },
      headers: CRM,
      _skipAuthRedirect: true,
    })
    await searchPeople('Оле')
    expect(http.get).toHaveBeenLastCalledWith('/api/v1/planner/people', {
      params: { q: 'Оле' },
      headers: CRM,
      _skipAuthRedirect: true,
    })
  })

  it('create sends the form Idempotency-Key; change sends If-Match with the version and reads ETag', async () => {
    await createTask('SKL', { title: 'A' }, 'key-1')
    expect(http.post).toHaveBeenCalledWith(
      '/api/v1/planner/boards/SKL/tasks',
      { title: 'A' },
      { headers: { ...CRM, 'Idempotency-Key': 'key-1' }, _skipAuthRedirect: true }
    )
    const { etag } = await patchTask('t-1', 3, { status_id: 's-2' })
    expect(http.patch).toHaveBeenCalledWith(
      '/api/v1/planner/tasks/t-1',
      { status_id: 's-2' },
      { headers: { ...CRM, 'If-Match': '"3"' }, _skipAuthRedirect: true }
    )
    expect(etag).toBe('"4"')
    expect(ifMatch(12)).toBe('"12"')
  })

  it('kanban and the board list carry the filters of 3.13; /me for «Мої» (5.3)', async () => {
    const filters = {
      assignee_user_id: 'u-1',
      label_id: 'l-1',
      overdue: 'true' as const,
      q: 'залишки',
    }
    await getBoardKanban('SKL', filters)
    expect(http.get).toHaveBeenLastCalledWith('/api/v1/planner/boards/SKL/kanban', {
      params: filters,
      headers: CRM,
      _skipAuthRedirect: true,
    })
    await listBoardTasks('SKL', filters)
    expect(http.get).toHaveBeenLastCalledWith('/api/v1/planner/boards/SKL/tasks', {
      params: { limit: 500, ...filters },
      headers: CRM,
      _skipAuthRedirect: true,
    })
    await getMe()
    expect(http.get).toHaveBeenLastCalledWith('/api/v1/planner/me', {
      headers: CRM,
      _skipAuthRedirect: true,
    })
  })

  it('a board code is a path segment, escaped', async () => {
    await listBoardTasks('A/B')
    expect(http.get.mock.calls[0][0]).toBe('/api/v1/planner/boards/A%2FB/tasks')
  })
})

describe('planner lists poll at least every 30 s and on return to the tab', () => {
  it('«Мої задачі» and the board tasks', async () => {
    http.get.mockResolvedValue({ data: { items: [], has_more: false }, headers: {} })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const mine = renderHook(() => usePlannerMyTasks(), { wrapper })
    const board = renderHook(() => usePlannerBoardTasks('SKL'), { wrapper })
    const kanban = renderHook(() => usePlannerBoardKanban('SKL', {}), { wrapper })
    await waitFor(() => expect(mine.result.current.isSuccess).toBe(true))
    await waitFor(() => expect(board.result.current.isSuccess).toBe(true))
    await waitFor(() => expect(kanban.result.current.isSuccess).toBe(true))

    expect(PLANNER_POLL_MS).toBeLessThanOrEqual(30_000)
    for (const key of [
      plannerKeys.myTasks(),
      plannerKeys.boardTaskList('SKL', {}),
      plannerKeys.boardKanban('SKL', {}),
    ]) {
      const options = queryClient.getQueryCache().find({ queryKey: key })?.options as {
        refetchInterval?: number
        refetchOnWindowFocus?: boolean
      }
      expect(options.refetchInterval).toBe(PLANNER_POLL_MS)
      expect(options.refetchOnWindowFocus).toBe(true)
    }
  })
})

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('Idempotency-Key is a UUID even without crypto.randomUUID', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('falls back to a v4 UUID from getRandomValues outside a secure context', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) })
    const keys = new Set(Array.from({ length: 20 }, () => newIdempotencyKey()))
    expect(keys.size).toBe(20)
    for (const key of keys) expect(key).toMatch(UUID_V4)
  })

  it('the fallback sets the version and variant bits', () => {
    expect(uuidV4FromRandomValues()).toMatch(UUID_V4)
  })
})

function httpError(status: number) {
  return new AxiosError('planner error', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code: 'x', message: 'server text', request_id: 'r1', details: {} } },
  })
}

function withClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, wrapper }
}

describe('the task panel stops polling only a task that is gone (404)', () => {
  beforeEach(() => vi.clearAllMocks())

  async function intervalAfter(error: unknown) {
    http.get.mockRejectedValueOnce(error)
    const { queryClient, wrapper } = withClient()
    const task = renderHook(() => usePlannerTask('SKL-99'), { wrapper })
    await waitFor(() => expect(task.result.current.isError).toBe(true))
    const query = queryClient.getQueryCache().find({ queryKey: plannerKeys.task('SKL-99') })!
    const interval = (query.options as { refetchInterval?: unknown }).refetchInterval as (
      q: typeof query
    ) => number | false
    return { query, interval }
  }

  it('404 — no 30 s refetch; the usual poll once it loads again', async () => {
    const { query, interval } = await intervalAfter(httpError(404))
    expect(interval(query)).toBe(false)
    query.setState({ status: 'success', error: null })
    expect(interval(query)).toBe(PLANNER_POLL_MS)
  })

  it('a network failure or a 503 during the poll does not stop it for good', async () => {
    const offline = await intervalAfter(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(offline.interval(offline.query)).toBe(PLANNER_POLL_MS)
    const down = await intervalAfter(httpError(503))
    expect(down.interval(down.query)).toBe(PLANNER_POLL_MS)
  })
})

describe('readPlannerError tells an unreachable planner from a refusal', () => {
  it('no answer at all — unreachable; an answer or a non-axios error — not', () => {
    expect(readPlannerError(new AxiosError('Network Error', 'ERR_NETWORK')).unreachable).toBe(true)
    expect(readPlannerError(httpError(503))).toMatchObject({ status: 503, unreachable: false })
    expect(readPlannerError(new Error('boom')).unreachable).toBe(false)
  })
})

describe('people search keeps the previous answer only while a name is refined', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refining keeps it; the field cleared after a pick and the next name start empty', async () => {
    const olena = {
      user_id: 'u-olena',
      crm_user_id: 41,
      full_name: 'Олена Коваль',
      never_logged_in: false,
      departments: [],
    }
    http.get.mockResolvedValueOnce({ data: { items: [olena] }, headers: {} })
    // Every later search stays in flight: what shows is only the placeholder.
    http.get.mockImplementation(() => new Promise(() => {}))
    const { wrapper } = withClient()
    const people = renderHook(({ q }) => usePlannerPeople(q), {
      wrapper,
      initialProps: { q: 'Оле' },
    })
    await waitFor(() => expect(people.result.current.data?.items).toEqual([olena]))

    // «Олен» extends «Оле»: the list does not blink.
    people.rerender({ q: 'Олен' })
    expect(people.result.current.data?.items).toEqual([olena])
    expect(people.result.current.isPlaceholderData).toBe(true)

    // A pick clears the field: '' is a prefix of everything, but it is no search.
    people.rerender({ q: '' })
    expect(people.result.current.data).toBeUndefined()
    // The first letter of the next name — still no search, nothing from before.
    people.rerender({ q: 'О' })
    expect(people.result.current.data).toBeUndefined()
    // An unrelated name — nothing from before either.
    people.rerender({ q: 'Іва' })
    expect(people.result.current.data).toBeUndefined()
  })
})
