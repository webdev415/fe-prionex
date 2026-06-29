/**
 * Session expiry heartbeat (KAN-760).
 *
 * KAN-759 expires the Redis session after 2 hours of inactivity, but the
 * non-auth backend services only check JWT signature + exp — they never
 * consult the session. So an idle operator can keep "working" against
 * client-service for hours after their Redis session has been evicted; no
 * 401 ever fires until the JWT's 15h hard cap.
 *
 * This module makes the 2h cap user-visible by scheduling a single
 * /auth/validate ping `SESSION_TTL_SECONDS + buffer` after the last
 * authenticated response. Any successful authenticated response resets the
 * timer, so an actively-working user never triggers a heartbeat.
 *
 * Performance:
 *   - active user (8h shift): 0 heartbeats fire
 *   - 1 idle stretch > 2h: 1 heartbeat → either succeeds (another tab kept
 *     the session warm) or returns valid:false → logout
 *   - estimated <100 pings/day across a typical 50-operator team
 *
 * The /auth/validate endpoint returns HTTP 200 with `{ valid: boolean }` —
 * NOT a 401 — so we must inspect the body ourselves rather than relying on
 * the api response interceptor to catch it.
 */
import { SESSION } from '@/constants'
import { api, getAccessToken, registerOnAuthenticatedSuccess, triggerAuthExpired } from '@/lib/api'

const HEARTBEAT_BUFFER_MS = 30 * 1000
const HEARTBEAT_DELAY_MS = SESSION.SESSION_TTL_SECONDS * 1000 + HEARTBEAT_BUFFER_MS

let timer: ReturnType<typeof setTimeout> | null = null

async function heartbeatTick() {
  try {
    const res = await api.post<{ valid: boolean }>('/api/v1/auth/validate')
    if (res.data?.valid === false) {
      triggerAuthExpired()
      return
    }
    // Session is still alive (likely kept warm by another tab). Re-arm.
    scheduleSessionHeartbeat()
  } catch {
    // Network blip or backend hiccup — don't kick the user out for that.
    // Re-arm; we'll try again after another idle stretch.
    scheduleSessionHeartbeat()
  }
}

export function scheduleSessionHeartbeat() {
  if (typeof window === 'undefined') return // SSR / test-env safety
  if (timer) clearTimeout(timer)
  timer = setTimeout(heartbeatTick, HEARTBEAT_DELAY_MS)
}

export function cancelSessionHeartbeat() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

/** Exposed for tests only. */
export const __test__ = {
  HEARTBEAT_DELAY_MS,
  hasActiveTimer: () => timer !== null,
  forceResetTimer: () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  },
}

// ---------------------------------------------------------------------------
// Module-load wiring:
//   1. Register with the api response interceptor so every successful
//      authenticated response resets this timer (active user → 0 pings).
//   2. If a token is already in storage at boot (e.g. page reload while
//      logged in), arm the timer immediately — without this the heartbeat
//      would only start firing after the next authenticated response, which
//      may never come if the user is on an idle dashboard.
// ---------------------------------------------------------------------------
registerOnAuthenticatedSuccess(scheduleSessionHeartbeat)

if (typeof window !== 'undefined' && getAccessToken()) {
  scheduleSessionHeartbeat()
}
