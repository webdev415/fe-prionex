import type { LoginResponse } from '@/types/api'
import { loginApprovalApi } from '../api/loginApprovalApi'
import type {
  AppApprovalClient,
  AppApprovalPollRequest,
  AppApprovalQrStart,
  AppApprovalStart,
} from '../types'
import {
  QR_REFRESH_RETRY_MS,
  approvalRefusalOf,
  isLoginRefusal,
  isModeUnavailable,
  isTransientRefusal,
  minutesToWait,
  pollIntervalMs,
  qrCodeTtlMs,
  qrRefreshDelayMs,
  requestTtlSeconds,
  type ApprovalRefusal,
} from './approval'

/**
 * What the browser sends to ask the phone: a login, the 2FA challenge of
 * `/login`, or nothing at all — a QR the phone scans (API-6, story 19.17).
 */
export type LoginApprovalStartBody =
  | { username: string }
  | { two_factor_token: string }
  | { qr: true }

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
  /**
   * QR mode: the code to scan, replaced every `qr_refresh_in` s while nobody
   * scanned it. `expiresAt` is the end of the request; `codeExpiresAt` is the
   * end of this very code (`qr_expires_in`) — past it the code is not shown.
   */
  | { kind: 'qr'; payload: string; startedAt: number; expiresAt: number; codeExpiresAt: number }
  /** QR mode: a phone scanned the code — the person confirms on it. */
  | { kind: 'scanned'; startedAt: number; expiresAt: number }
  /** Approved on the phone; the session is being persisted. */
  | { kind: 'completing' }
  | { kind: 'denied' }
  | { kind: 'expired' }
  /** Anything that is not the person's own refusal — shown with one generic text. */
  | { kind: 'failed' }
  /**
   * `429 APP_LOGIN_RATE_LIMITED`: too many requests from this address or person.
   * `retryAt` (`Date.now()`) is when the `minutes` shown have passed: no new
   * request before it — it would only earn another 429.
   */
  | { kind: 'rateLimited'; minutes: number; retryAt: number }
  /** `429 APP_LOGIN_BLOCKED` (2FA): «Це не я» blocked the method for a while. */
  | { kind: 'blocked'; minutes: number; retryAt: number }

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
 * one owner of its timers: `stop()` clears them, and every async answer that
 * lands after a stop is dropped instead of scheduling another poll.
 *
 * A QR request (`{ qr: true }`) runs the same poll; on top of it a second
 * timer asks for the next QR every `qr_refresh_in` s until a phone scans it.
 *
 * The `browser_secret` and the QR payload live in this closure only.
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
  /** QR mode: the code on screen while nobody scanned it; `null` once scanned or ended. */
  let qrShown: Extract<LoginApprovalPhase, { kind: 'qr' }> | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let scanned = false

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const clearRefresh = () => {
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  const halt = () => {
    active = false
    clearTimer()
    clearRefresh()
    qrShown = null
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

  const scheduleRefresh = (delay: number) => {
    clearRefresh()
    if (active && qrShown) refreshTimer = setTimeout(() => void refreshQr(), delay)
  }

  /**
   * No next code will come and the one on screen has died without the poll
   * telling an outcome: stop promising it — `expired`, with «Новий код».
   */
  const endQr = () => {
    refreshTimer = null
    if (active && qrShown) finish({ kind: 'expired' })
  }

  /** The next QR; the previous one stays valid until its own end, so a failure costs nothing yet. */
  const refreshQr = async () => {
    refreshTimer = null
    const current = request
    if (!active || current === null || !qrShown) return
    try {
      const next = await loginApprovalApi.refreshQr(current)
      if (!active || !qrShown) return
      qrShown = {
        ...qrShown,
        payload: next.qr_payload,
        codeExpiresAt: Date.now() + qrCodeTtlMs(next.qr_expires_in),
      }
      handlers.onPhase(qrShown)
      scheduleRefresh(qrRefreshDelayMs(next.qr_refresh_in))
    } catch (error) {
      if (!active || !qrShown) return
      const refusal = approvalRefusalOf(error)
      if (refusal.status === 429 || isTransientRefusal(refusal)) {
        // The card hides the code once `codeExpiresAt` passes and waits for this retry.
        scheduleRefresh(Math.max(QR_REFRESH_RETRY_MS, (refusal.retryAfterSeconds ?? 0) * 1000))
        return
      }
      // 409 (scanned or ended), 410 (expired), 404: no next code. The poll tells the
      // outcome; if it has not one interval after the code on screen died, `expired`.
      clearRefresh()
      refreshTimer = setTimeout(endQr, Math.max(0, qrShown.codeExpiresAt - Date.now()) + interval)
    }
  }

  /**
   * A phone claimed the QR: the scan restarts the decision window once.
   *
   * One way by the API-6 contract: `scanned` is `pending` + `scanned_at`, and
   * api-prionex sets `scanned_at` only in `LoginApproval.claim` and never clears
   * it (`services/auth/app/domain/login_approval.py`: `claimable` refuses a
   * request with `scanned_at`, `browser_status` answers `scanned` for a pending
   * one with it). So no `pending` follows a `scanned`; a phone that backs out
   * leaves the request to «Відхилити» or its expiry, and the QR is not shown again.
   */
  const showScanned = (expiresIn: number | null | undefined) => {
    clearRefresh()
    qrShown = null
    const now = Date.now()
    if (!scanned) {
      scanned = true
      const expiresAt = now + requestTtlSeconds(expiresIn) * 1000
      deadline = expiresAt + interval
      handlers.onPhase({ kind: 'scanned', startedAt: now, expiresAt })
    } else if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) {
      deadline = Math.min(deadline, now + expiresIn * 1000 + interval)
    }
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
      if (answer.status === 'scanned') {
        showScanned(answer.expires_in)
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

  /** The start call of the mode; the QR one sends no login at all. */
  const open = async (): Promise<
    { qr: true; started: AppApprovalQrStart } | { qr: false; started: AppApprovalStart }
  > =>
    'qr' in body
      ? { qr: true, started: await loginApprovalApi.startQr({ client: handlers.client }) }
      : { qr: false, started: await loginApprovalApi.start({ ...body, client: handlers.client }) }

  const begin = async () => {
    handlers.onPhase({ kind: 'starting' })
    try {
      const opened = await open()
      const { started } = opened
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
      if (opened.qr) {
        qrShown = {
          kind: 'qr',
          payload: opened.started.qr_payload,
          startedAt,
          expiresAt,
          codeExpiresAt: startedAt + qrCodeTtlMs(opened.started.qr_expires_in),
        }
        handlers.onPhase(qrShown)
        scheduleRefresh(qrRefreshDelayMs(opened.started.qr_refresh_in))
      } else {
        handlers.onPhase({ kind: 'waiting', number: opened.started.number, startedAt, expiresAt })
      }
      schedule(interval)
    } catch (error) {
      if (!active) return
      const refusal = approvalRefusalOf(error)
      if (refusal.status === 429) {
        const minutes = minutesToWait(refusal.retryAfterSeconds)
        const retryAt = Date.now() + minutes * 60_000
        finish(
          refusal.code === 'APP_LOGIN_BLOCKED'
            ? { kind: 'blocked', minutes, retryAt }
            : { kind: 'rateLimited', minutes, retryAt }
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
