/**
 * Planner operation functions (planner story 1.9, AC5; 1.10): one HTTP client
 * (the shared axios of `src/lib/api.ts`), full path `/api/v1/planner/…`,
 * `X-Planner-Client: crm`, `If-Match` / `Idempotency-Key` where the contract
 * asks, and a planner 401 must not sign the user out of the CRM.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, default: http, api: http }
})

import {
  createTask,
  getMeta,
  ifMatch,
  listBoardTasks,
  listMyTasks,
  patchTask,
  resolveTask,
  searchPeople,
} from '../plannerApi'
import {
  PLANNER_POLL_MS,
  plannerKeys,
  usePlannerBoardTasks,
  usePlannerMyTasks,
} from '../plannerQueries'

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
    await waitFor(() => expect(mine.result.current.isSuccess).toBe(true))
    await waitFor(() => expect(board.result.current.isSuccess).toBe(true))

    expect(PLANNER_POLL_MS).toBeLessThanOrEqual(30_000)
    for (const key of [plannerKeys.myTasks(), plannerKeys.boardTasks('SKL')]) {
      const options = queryClient.getQueryCache().find({ queryKey: key })?.options as {
        refetchInterval?: number
        refetchOnWindowFocus?: boolean
      }
      expect(options.refetchInterval).toBe(PLANNER_POLL_MS)
      expect(options.refetchOnWindowFocus).toBe(true)
    }
  })
})
