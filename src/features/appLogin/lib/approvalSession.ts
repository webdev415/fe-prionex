import type { LoginResponse } from '@/types/api'
import { loginApprovalApi } from '../api/loginApprovalApi'
import type { AppApprovalClient, AppApprovalPollRequest } from '../types'
import {
  approvalRefusalOf,
  isLoginRefusal,
  isModeUnavailable,
  isTransientRefusal,
  minutesToWait,
  pollIntervalMs,
  requestTtlSeconds,
  type ApprovalRefusal,
} from './approval'

/** What the browser sends to ask the phone: a login, or the 2FA challenge of `/login`. */
export type LoginApprovalStartBody = { username: string } | { two_factor_token: string }

/** Where one confirmation request stands, as the approval card draws it. */
export type LoginApprovalPhase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | {
      kind: 'waiting'
      number: number
      /** `Date.now()` when the request was accepted. */
      startedAt: number
      /** `Date.now()` when the server lets it expire. */
      expiresAt: number
    }
  /** Approved on the phone; the session is being persisted. */
  | { kind: 'completing' }
  | { kind: 'denied' }
  | { kind: 'expired' }
  /** Anything that is not the person's own refusal — shown with one generic text. */
  | { kind: 'failed' }
  /** `429 APP_LOGIN_RATE_LIMITED`: too many requests from this address or person. */
  | { kind: 'rateLimited'; minutes: number }
  /** `429 APP_LOGIN_BLOCKED` (2FA): «Це не я» blocked the method for a while. */
  | { kind: 'blocked'; minutes: number }

export interface ApprovalSessionHandlers {
  client: AppApprovalClient
  onPhase: (phase: LoginApprovalPhase) => void
  /** The phone approved: persist the session like `/login`. A throw shows `failed`. */
  onApproved: (login: LoginResponse) => Promise<void> | void
  /** A `/login` refusal (account locked, IP not allowed, dead 2FA challenge…). */
  onRefused: (refusal: ApprovalRefusal) => void
  /** The phone cannot be asked (mode off, no phone). */
  onUnavailable: () => void
}

export interface ApprovalSession {
  /**
   * Stop for good: no further poll, no further phase. A request the server
   * still holds as pending is cancelled there (best effort) so the phone does
   * not keep offering it.
   */
  stop: () => void
}

/**
 * One request from `start` to its outcome. Kept outside React so the loop has
 * one owner of its timer: `stop()` clears it, and every async answer that
 * lands after a stop is dropped instead of scheduling another poll.
 *
 * The `browser_secret` lives in this closure only.
 */
export function runApprovalSession(
  body: LoginApprovalStartBody,
  handlers: ApprovalSessionHandlers
): ApprovalSession {
  let active = true
  let request: AppApprovalPollRequest | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let interval = pollIntervalMs(undefined)
  /** Past this moment no poll is sent; the server has had a full interval to say `expired`. */
  let deadline = 0

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const halt = () => {
    active = false
    clearTimer()
    request = null
  }

  const finish = (phase: LoginApprovalPhase) => {
    halt()
    handlers.onPhase(phase)
  }

  const refuse = (refusal: ApprovalRefusal) => {
    halt()
    handlers.onRefused(refusal)
  }

  const cancelOnServer = (pending: AppApprovalPollRequest) => {
    loginApprovalApi.cancel(pending).catch(() => {
      // Best effort: the request expires on the server by itself.
    })
  }

  const schedule = (delay: number) => {
    clearTimer()
    if (active) timer = setTimeout(() => void tick(), delay)
  }

  const tick = async () => {
    timer = null
    const current = request
    if (!active || current === null) return
    if (Date.now() >= deadline) {
      finish({ kind: 'expired' })
      return
    }

    try {
      const answer = await loginApprovalApi.poll(current)
      if (!active) return

      if (answer.status === 'pending') {
        // The server's clock only shortens the local deadline, never extends it.
        if (typeof answer.expires_in === 'number' && Number.isFinite(answer.expires_in)) {
          deadline = Math.min(deadline, Date.now() + answer.expires_in * 1000 + interval)
        }
        schedule(interval)
        return
      }
      if (answer.status === 'approved') {
        halt()
        if (!answer.login) {
          handlers.onPhase({ kind: 'failed' })
          return
        }
        handlers.onPhase({ kind: 'completing' })
        try {
          await handlers.onApproved(answer.login)
        } catch {
          handlers.onPhase({ kind: 'failed' })
        }
        return
      }
      finish({ kind: answer.status === 'denied' ? 'denied' : 'expired' })
    } catch (error) {
      if (!active) return
      const refusal = approvalRefusalOf(error)
      if (refusal.status === 429) {
        // APP_LOGIN_POLL_TOO_FAST: wait at least what the server asked for.
        schedule(Math.max(interval, (refusal.retryAfterSeconds ?? 1) * 1000))
      } else if (isTransientRefusal(refusal)) {
        schedule(interval)
      } else if (isLoginRefusal(refusal)) {
        refuse(refusal)
      } else {
        finish({ kind: 'failed' })
      }
    }
  }

  const begin = async () => {
    handlers.onPhase({ kind: 'starting' })
    try {
      const started = await loginApprovalApi.start({ ...body, client: handlers.client })
      const accepted = {
        request_id: started.request_id,
        browser_secret: started.browser_secret,
      }
      if (!active) {
        // Stopped while the start was in flight: the phone must not show it.
        cancelOnServer(accepted)
        return
      }
      request = accepted
      interval = pollIntervalMs(started.poll_interval_ms)
      const startedAt = Date.now()
      const expiresAt = startedAt + requestTtlSeconds(started.expires_in) * 1000
      deadline = expiresAt + interval
      handlers.onPhase({ kind: 'waiting', number: started.number, startedAt, expiresAt })
      schedule(interval)
    } catch (error) {
      if (!active) return
      const refusal = approvalRefusalOf(error)
      if (refusal.status === 429) {
        const minutes = minutesToWait(refusal.retryAfterSeconds)
        finish(
          refusal.code === 'APP_LOGIN_BLOCKED'
            ? { kind: 'blocked', minutes }
            : { kind: 'rateLimited', minutes }
        )
      } else if (isLoginRefusal(refusal)) {
        refuse(refusal)
      } else if (isModeUnavailable(refusal)) {
        halt()
        handlers.onUnavailable()
      } else {
        finish({ kind: 'failed' })
      }
    }
  }

  void begin()

  return {
    stop: () => {
      const pending = request
      halt()
      if (pending) cancelOnServer(pending)
    },
  }
}
