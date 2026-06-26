/**
 * Tests for the idle-session heartbeat (KAN-760).
 *
 * Uses vi fake timers to advance past HEARTBEAT_DELAY_MS without waiting
 * 2 real hours, and swaps `api.defaults.adapter` to dictate /auth/validate
 * response shapes.
 */
import type { AxiosAdapter } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, getAccessToken, setAccessToken } from '@/lib/api'
import { __test__, cancelSessionHeartbeat, scheduleSessionHeartbeat } from '@/lib/sessionHeartbeat'
import { useAuthStore } from '@/stores/authStore'

const originalAdapter = api.defaults.adapter

let validateCalls: number
let lastHref: string

function adapter(validResponse: boolean | 'reject'): AxiosAdapter {
  return (config) => {
    if (config.url?.includes('/auth/validate')) {
      validateCalls += 1
      if (validResponse === 'reject') {
        return Promise.reject(new Error('Network down'))
      }
      return Promise.resolve({
        data: { valid: validResponse },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      })
    }
    return Promise.reject(new Error('Unexpected URL ' + config.url))
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  validateCalls = 0
  setAccessToken('test-token')
  useAuthStore.setState({
    user: { id: 1, username: 'op' } as never,
    isAuthenticated: true,
    isImpersonating: false,
    impersonatedUser: null,
    originalAdminUser: null,
  })
  __test__.forceResetTimer()

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
  __test__.forceResetTimer()
  api.defaults.adapter = originalAdapter
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('sessionHeartbeat', () => {
  it('does not fire before HEARTBEAT_DELAY_MS', async () => {
    api.defaults.adapter = adapter(true)
    scheduleSessionHeartbeat()

    await vi.advanceTimersByTimeAsync(__test__.HEARTBEAT_DELAY_MS - 1000)

    expect(validateCalls).toBe(0)
  })

  it('pings /auth/validate after HEARTBEAT_DELAY_MS of inactivity', async () => {
    api.defaults.adapter = adapter(true)
    scheduleSessionHeartbeat()

    await vi.advanceTimersByTimeAsync(__test__.HEARTBEAT_DELAY_MS + 100)

    expect(validateCalls).toBe(1)
  })

  it('logs the user out when /auth/validate returns valid:false', async () => {
    api.defaults.adapter = adapter(false)
    scheduleSessionHeartbeat()

    await vi.advanceTimersByTimeAsync(__test__.HEARTBEAT_DELAY_MS + 100)

    expect(getAccessToken()).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(lastHref).toBe('/login')
  })

  it('reschedules (does NOT log out) on network error during heartbeat', async () => {
    api.defaults.adapter = adapter('reject')
    scheduleSessionHeartbeat()

    await vi.advanceTimersByTimeAsync(__test__.HEARTBEAT_DELAY_MS + 100)

    expect(getAccessToken()).toBe('test-token')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(lastHref).toBe('')
    expect(__test__.hasActiveTimer()).toBe(true)
  })

  it('reschedules when /auth/validate confirms the session is still alive', async () => {
    api.defaults.adapter = adapter(true)
    scheduleSessionHeartbeat()

    await vi.advanceTimersByTimeAsync(__test__.HEARTBEAT_DELAY_MS + 100)

    expect(validateCalls).toBe(1)
    expect(__test__.hasActiveTimer()).toBe(true)

    await vi.advanceTimersByTimeAsync(__test__.HEARTBEAT_DELAY_MS + 100)
    expect(validateCalls).toBe(2)
  })

  it('cancelSessionHeartbeat clears the timer so no ping fires', async () => {
    api.defaults.adapter = adapter(true)
    scheduleSessionHeartbeat()
    cancelSessionHeartbeat()

    await vi.advanceTimersByTimeAsync(__test__.HEARTBEAT_DELAY_MS + 100)

    expect(validateCalls).toBe(0)
    expect(__test__.hasActiveTimer()).toBe(false)
  })
})
