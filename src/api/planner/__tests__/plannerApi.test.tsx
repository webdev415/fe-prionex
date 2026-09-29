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
import axios, { AxiosError, AxiosHeaders, type AxiosRequestConfig } from 'axios'

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
  newIdempotencyKey,
  patchTask,
  resolveTask,
  searchPeople,
  uploadTaskAttachment,
  uuidV4FromRandomValues,
} from '../plannerApi'
import {
  PLANNER_POLL_MS,
  plannerKeys,
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

  it('a board code is a path segment, escaped', async () => {
    await listBoardTasks('A/B')
    expect(http.get.mock.calls[0][0]).toBe('/api/v1/planner/boards/A%2FB/tasks')
  })

  it('upload: the part «file», its own key, a budget by the file size instead of 75 s, progress (bot round 1 on PR #351)', async () => {
    const file = new File(['x'], 'scan.pdf')
    Object.defineProperty(file, 'size', { value: 52_428_800 })
    const onProgress = vi.fn()
    await uploadTaskAttachment('t-1', file, 'file-key', onProgress)
    const [path, body, cfg] = http.post.mock.calls[0] as [string, FormData, AxiosRequestConfig]
    expect(path).toBe('/api/v1/planner/tasks/t-1/attachments')
    expect((body.get('file') as File).name).toBe('scan.pdf')
    expect(cfg.headers).toEqual({
      ...CRM,
      'Idempotency-Key': 'file-key',
      'Content-Type': 'multipart/form-data',
    })
    // 50 MiB: 75 s of the shared client + the file at 64 KiB/s — not the 75 s
    // of a JSON call, and not «no limit» (the form is locked meanwhile).
    expect(cfg.timeout).toBe(875_000)
    cfg.onUploadProgress?.({
      loaded: 10,
      total: 40,
      progress: 0.25,
      bytes: 10,
      lengthComputable: true,
    })
    cfg.onUploadProgress?.({ loaded: 10, bytes: 10, lengthComputable: false })
    expect(onProgress.mock.calls).toEqual([[0.25]])

    const small = new File(['x'], 'a.txt')
    await uploadTaskAttachment('t-1', small, 'k-2')
    const smallCfg = http.post.mock.calls[1][2] as AxiosRequestConfig
    expect(smallCfg.timeout).toBe(75_001)
    expect(smallCfg.onUploadProgress).toBeUndefined()
  })

  it('upload: under the shared JSON default the body stays FormData (the multipart header is not a no-op)', async () => {
    await uploadTaskAttachment('t-1', new File(['abc'], 'a.txt'), 'k-1')
    const [, body, cfg] = http.post.mock.calls[0] as [string, FormData, AxiosRequestConfig]
    // The shared client of src/lib/api.ts, with an adapter that keeps what would be sent.
    let sent: unknown
    const shared = axios.create({
      headers: { 'Content-Type': 'application/json' },
      adapter: async (config) => {
        sent = config.data
        return { data: {}, status: 201, statusText: '', headers: {}, config }
      },
    })
    await shared.post('/x', body, cfg)
    expect(sent).toBeInstanceOf(FormData)
    // Without the header axios would send `{"file":{}}` — the file lost.
    const withoutType = Object.fromEntries(
      Object.entries(cfg.headers as Record<string, string>).filter(
        ([name]) => name !== 'Content-Type'
      )
    )
    await shared.post('/x', body, { ...cfg, headers: withoutType })
    expect(sent).toBe('{"file":{}}')
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
