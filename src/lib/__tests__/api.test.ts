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

import { api, getAccessToken, setAccessToken } from '@/lib/api'
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
