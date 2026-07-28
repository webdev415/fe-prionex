/**
 * Tests for the 401 → silent redirect interceptor (KAN-760).
 *
 * Strategy: swap `api.defaults.adapter` with a controlled vi.fn() so we can
 * dictate response/error shapes without any HTTP-mocking dependency. Window
 * navigation is intercepted via Object.defineProperty so jsdom does not
 * throw "navigation not implemented".
 */
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  api,
  getAccessToken,
  isDefinitiveAuthFailure,
  runOnceOnNextAuthSuccess,
  setAccessToken,
} from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const originalAdapter = api.defaults.adapter

function makeAdapter(responder: AxiosAdapter): AxiosAdapter {
  return responder
}

let lastHref: string

beforeEach(() => {
  setAccessToken('test-token')
  useAuthStore.setState({
    user: { id: 1, username: 'op' } as never,
    isAuthenticated: true,
    isImpersonating: false,
    impersonatedUser: null,
    originalAdminUser: null,
  })

  lastHref = ''
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return lastHref
      },
      set href(v: string) {
        lastHref = v
      },
    },
  })
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('api response interceptor — 401 silent redirect', () => {
  it('clears the token and redirects to /login on 401 from a non-auth URL', async () => {
    api.defaults.adapter = makeAdapter(() =>
      Promise.reject(
        Object.assign(new Error('Unauthorized'), {
          isAxiosError: true,
          response: { status: 401, data: {}, headers: {}, statusText: 'Unauthorized' },
          config: { url: '/api/v1/clients', headers: {} },
        })
      )
    )

    await expect(api.get('/api/v1/clients')).rejects.toBeTruthy()

    expect(getAccessToken()).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(lastHref).toBe('/login')
  })

  it('does NOT clear or redirect on 401 from the login endpoint (wrong password)', async () => {
    api.defaults.adapter = makeAdapter(() =>
      Promise.reject(
        Object.assign(new Error('Unauthorized'), {
          isAxiosError: true,
          response: {
            status: 401,
            data: { detail: 'Invalid credentials' },
            headers: {},
            statusText: 'Unauthorized',
          },
          config: { url: '/api/v1/auth/login', headers: {} },
        })
      )
    )

    await expect(
      api.post('/api/v1/auth/login', { username: 'x', password: 'wrong' })
    ).rejects.toBeTruthy()

    expect(getAccessToken()).toBe('test-token')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(lastHref).toBe('')
  })

  it('does NOT clear or redirect on 401 from any /auth/* endpoint (e.g. /auth/validate from the heartbeat)', async () => {
    api.defaults.adapter = makeAdapter(() =>
      Promise.reject(
        Object.assign(new Error('Unauthorized'), {
          isAxiosError: true,
          response: { status: 401, data: {}, headers: {}, statusText: 'Unauthorized' },
          config: { url: '/api/v1/auth/validate', headers: {} },
        })
      )
    )

    await expect(api.post('/api/v1/auth/validate')).rejects.toBeTruthy()

    expect(getAccessToken()).toBe('test-token')
    expect(lastHref).toBe('')
  })

  it('lets 403, 404, 500 bubble through without clearing or redirecting', async () => {
    for (const status of [403, 404, 500]) {
      lastHref = ''
      setAccessToken('test-token')

      api.defaults.adapter = makeAdapter(() =>
        Promise.reject(
          Object.assign(new Error(`HTTP ${status}`), {
            isAxiosError: true,
            response: { status, data: {}, headers: {}, statusText: 'Err' },
            config: { url: '/api/v1/clients', headers: {} },
          })
        )
      )

      await expect(api.get('/api/v1/clients')).rejects.toBeTruthy()

      expect(getAccessToken()).toBe('test-token')
      expect(lastHref).toBe('')
    }
  })
})

describe('api response interceptor — transient-error retry (R3 #2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function makeTransientReject(
    status: number | null,
    options: { url?: string; method?: string; code?: string } = {}
  ): AxiosAdapter {
    return () =>
      Promise.reject(
        Object.assign(new Error(`Transient ${status ?? options.code}`), {
          isAxiosError: true,
          response:
            status !== null ? { status, data: {}, headers: {}, statusText: 'Err' } : undefined,
          code: options.code,
          config: {
            url: options.url ?? '/api/v1/clients',
            method: options.method ?? 'get',
            headers: {},
          },
        })
      )
  }

  it('retries a GET that returns 502, then succeeds on retry', async () => {
    const attempts: number[] = []
    api.defaults.adapter = ((config) => {
      attempts.push(attempts.length + 1)
      if (attempts.length === 1) {
        return Promise.reject(
          Object.assign(new Error('Bad Gateway'), {
            isAxiosError: true,
            response: { status: 502, data: {}, headers: {}, statusText: 'Bad Gateway' },
            config,
          })
        )
      }
      return Promise.resolve({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      })
    }) as AxiosAdapter

    const promise = api.get('/api/v1/clients')
    // Initial reject is synchronous-ish — flush microtasks + advance past 500ms backoff.
    await vi.advanceTimersByTimeAsync(600)
    const res = await promise

    expect(res.status).toBe(200)
    expect(attempts.length).toBe(2)
  })

  it('retries 503 + 504 + network errors on GETs', async () => {
    for (const transient of [
      { status: 503 },
      { status: 504 },
      { status: null, code: 'ECONNABORTED' },
      { status: null, code: 'ERR_NETWORK' },
    ]) {
      const counter = { n: 0 }
      api.defaults.adapter = ((config) => {
        counter.n += 1
        if (counter.n === 1) {
          return Promise.reject(
            Object.assign(new Error('Transient'), {
              isAxiosError: true,
              response:
                transient.status !== null
                  ? { status: transient.status, data: {}, headers: {}, statusText: 'Err' }
                  : undefined,
              code: transient.code,
              config,
            })
          )
        }
        return Promise.resolve({
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        })
      }) as AxiosAdapter

      const promise = api.get('/api/v1/clients')
      await vi.advanceTimersByTimeAsync(600)
      const res = await promise

      expect(res.status).toBe(200)
      expect(counter.n).toBe(2)
    }
  })

  it('does NOT retry POST/PUT/PATCH/DELETE (mutations) on 502', async () => {
    for (const method of ['post', 'put', 'patch', 'delete']) {
      let attempts = 0
      api.defaults.adapter = ((config) => {
        attempts += 1
        return Promise.reject(
          Object.assign(new Error('Bad Gateway'), {
            isAxiosError: true,
            response: { status: 502, data: {}, headers: {}, statusText: 'Bad Gateway' },
            config,
          })
        )
      }) as AxiosAdapter

      const promise = (api as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[
        method
      ]('/api/v1/clients')
      // Attach the rejection-handler promise BEFORE advancing timers so the
      // rejection has a listener when it settles (avoids vitest "unhandled
      // rejection" warnings).
      const expectation = expect(promise).rejects.toBeTruthy()
      await vi.advanceTimersByTimeAsync(5000) // generous; we expect NO retry
      await expectation

      expect(attempts).toBe(1)
    }
  })

  it('does NOT retry GETs to /auth/* endpoints (login loop guard)', async () => {
    let attempts = 0
    api.defaults.adapter = makeTransientReject(502, { url: '/api/v1/auth/me' })
    api.defaults.adapter = ((config) => {
      attempts += 1
      return Promise.reject(
        Object.assign(new Error('Bad Gateway'), {
          isAxiosError: true,
          response: { status: 502, data: {}, headers: {}, statusText: 'Bad Gateway' },
          config,
        })
      )
    }) as AxiosAdapter

    const promise = api.get('/api/v1/auth/me')
    const expectation = expect(promise).rejects.toBeTruthy()
    await vi.advanceTimersByTimeAsync(5000)
    await expectation

    expect(attempts).toBe(1)
  })

  it('gives up after TRANSIENT_RETRY_MAX (2) retries on persistent 502', async () => {
    let attempts = 0
    api.defaults.adapter = ((config) => {
      attempts += 1
      return Promise.reject(
        Object.assign(new Error('Bad Gateway'), {
          isAxiosError: true,
          response: { status: 502, data: {}, headers: {}, statusText: 'Bad Gateway' },
          config,
        })
      )
    }) as AxiosAdapter

    const promise = api.get('/api/v1/clients')
    const expectation = expect(promise).rejects.toBeTruthy()
    // Two retries: 500ms + 1000ms. Advance well past.
    await vi.advanceTimersByTimeAsync(5000)
    await expectation

    expect(attempts).toBe(3) // initial + 2 retries
  })

  it('does NOT retry on 4xx (404/422) — not transient', async () => {
    for (const status of [400, 404, 422]) {
      let attempts = 0
      api.defaults.adapter = ((config) => {
        attempts += 1
        return Promise.reject(
          Object.assign(new Error(`HTTP ${status}`), {
            isAxiosError: true,
            response: { status, data: {}, headers: {}, statusText: 'Err' },
            config,
          })
        )
      }) as AxiosAdapter

      const promise = api.get('/api/v1/clients')
      const expectation = expect(promise).rejects.toBeTruthy()
      await vi.advanceTimersByTimeAsync(5000)
      await expectation

      expect(attempts).toBe(1)
    }
  })
})

// KAN-730 — only a real 401 is a definitive auth failure.
describe('isDefinitiveAuthFailure', () => {
  const axiosErr = (extra: Record<string, unknown>) =>
    Object.assign(new Error('err'), { isAxiosError: true, ...extra })

  it('is true only for a 401 response', () => {
    expect(isDefinitiveAuthFailure(axiosErr({ response: { status: 401 } }))).toBe(true)
  })

  it('is false for a network error (no response)', () => {
    expect(isDefinitiveAuthFailure(axiosErr({ code: 'ERR_NETWORK' }))).toBe(false)
  })

  it('is false for 5xx and other 4xx', () => {
    for (const status of [400, 403, 404, 500, 502, 503, 504]) {
      expect(isDefinitiveAuthFailure(axiosErr({ response: { status } }))).toBe(false)
    }
  })

  it('is false for a non-axios error or non-error value', () => {
    expect(isDefinitiveAuthFailure(new Error('boom'))).toBe(false)
    expect(isDefinitiveAuthFailure(null)).toBe(false)
    expect(isDefinitiveAuthFailure(undefined)).toBe(false)
  })
})

// KAN-730 — the "reconnecting" toast dismiss fires only when auth-service
// itself responds successfully (not any request; other services stay up
// during an auth-only outage).
describe('runOnceOnNextAuthSuccess — dismiss on auth-service success only', () => {
  const okAdapter: AxiosAdapter = (config) =>
    Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config })

  beforeEach(() => {
    api.defaults.adapter = okAdapter
  })

  it('fires on a successful /users/* response', async () => {
    const cb = vi.fn()
    runOnceOnNextAuthSuccess(cb)
    await api.get('/api/v1/users/me')
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('fires on a successful /auth/* response', async () => {
    const cb = vi.fn()
    runOnceOnNextAuthSuccess(cb)
    await api.put('/api/v1/auth/me/tabs/snapshot')
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire on a non-auth-service success, then DOES on the next auth success', async () => {
    const cb = vi.fn()
    runOnceOnNextAuthSuccess(cb)
    await api.get('/api/v1/clients') // other service up during an auth-only outage
    expect(cb).not.toHaveBeenCalled()
    await api.get('/api/v1/users/me') // auth back → fires (and drains the queue)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('fires only once — the queue is cleared after firing', async () => {
    const cb = vi.fn()
    runOnceOnNextAuthSuccess(cb)
    await api.get('/api/v1/users/me')
    await api.get('/api/v1/users/me')
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
