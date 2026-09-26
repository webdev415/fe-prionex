/**
 * Phone binding for the mobile app (Epic 19 / board #1532).
 *
 * A person binds their phone in the CRM profile. From then on a sign-in and a
 * token refresh signed by that phone's device key are accepted from any
 * network — the global IP whitelist is skipped for that phone only. Every
 * other check (account status, project/role, 2FA) stays.
 *
 * The contract below follows the Epic 19 API-2 draft
 * (`reports/app-login-confirmation-2026-09-25/EPIC-DRAFT.md`, DESIGN §8.3).
 * Fields marked optional are ones the draft does not pin down; the UI works
 * without them.
 */

import type { LoginResponse } from '@/types/api'

export type AppLoginPlatform = 'ios' | 'android'

export interface AppLoginDevice {
  id: string
  /** Name the phone reported at enrollment, e.g. "iPhone 15". */
  label: string
  platform: AppLoginPlatform | string
  /** Nullable in the API schema (`AppLoginDeviceInfo.created_at`). */
  created_at: string | null
  last_used_at?: string | null
  last_used_ip?: string | null
}

export type AppLoginAttemptStatus =
  | 'requested'
  | 'approved'
  | 'denied'
  | 'not_me'
  | 'number_mismatch'
  | 'expired'
  | 'consumed'
  | 'superseded'
  | 'rate_limited'
  | 'push_suppressed'
  | 'session_terminated'

/** One row of `recent` — the API's `AppLoginAttemptInfo`. */
export interface AppLoginAttempt {
  created_at?: string | null
  status: AppLoginAttemptStatus | string
  mode: string
  ip?: string | null
  device_id?: string | null
}

/** `GET /api/v1/users/me/app-login` and the admin twin. */
export interface AppLoginStatus {
  /** `false` while `AUTH_APP_LOGIN_ENABLED` is off — the section stays hidden. */
  feature_available: boolean
  enabled?: boolean
  /**
   * `AUTH_APP_LOGIN_DEVICE_IP_BYPASS_ENABLED` on this stand. While it is off a
   * bound phone still signs in under the IP whitelist, so the profile must not
   * promise «from any network».
   */
  device_ip_bypass?: boolean
  devices?: AppLoginDevice[]
  max_devices?: number
  recent?: AppLoginAttempt[]
}

export interface AppLoginEnableRequest {
  password: string
  /** Google Authenticator code; required by the API only when 2FA is on. */
  code?: string
}

/** `POST /api/v1/users/me/app-login/enable`. */
export interface AppLoginPairing {
  /** 8 Crockford characters; the UI shows it as `ABCD-EFGH`. */
  pairing_code: string
  /**
   * `prionexhub://app-login/pair?c=<code>&e=<ENVIRONMENT>` — built by the API
   * only (`e` is the server's ENVIRONMENT name, which the web cannot know).
   */
  pairing_url?: string
  /** Seconds the code stays valid (300 by the design). */
  expires_in: number
  /**
   * Server-rendered QR of `pairing_url`, PNG base64 without the `data:` prefix —
   * the same shape as the 2FA setup QR. The CRM web has no QR library, so
   * without this field the screen shows the code and the link only.
   */
  pairing_qr_png_base64?: string | null
}

export interface AppLoginDisableRequest {
  password: string
}

// ─── Sign-in confirmed on the bound phone (Epic 19 API-3, story 19-5) ──────
// Contract: api-prionex `docs/auth-app-login-device-binding.md`, «Login approval».

/** Which site asks; the phone shows «CRM» or «Prionex Hub» from it. */
export type AppApprovalClient = 'crm_web' | 'hub_web'

/** `GET /api/v1/auth/app-login/config` (no auth) — which buttons this stand offers. */
export interface AppApprovalConfig {
  /** Show «Увійти через підтвердження в Prionex» on the password form. */
  passwordless: boolean
  /** The 2FA step may offer the phone (when `/login` lists `'app'`). */
  second_factor: boolean
  /** Seconds a request lives. */
  request_ttl: number
  poll_interval_ms: number
}

/** `POST …/start` — exactly one of the two modes. */
export type AppApprovalStartRequest =
  | { username: string; client: AppApprovalClient }
  | { two_factor_token: string; client: AppApprovalClient }

/** `202` of `…/start`. `browser_secret` is kept in memory only. */
export interface AppApprovalStart {
  request_id: string
  browser_secret: string
  /** 10..99 — the person types it into Prionex Hub. */
  number: number
  expires_in: number
  poll_interval_ms: number
}

/** Body of `…/poll` and `…/cancel`. */
export interface AppApprovalPollRequest {
  request_id: string
  browser_secret: string
}

export type AppApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired'

/** `…/poll`: `approved` carries the same `LoginResponse` as `/login`. */
export interface AppApprovalPoll {
  status: AppApprovalStatus
  expires_in?: number | null
  login?: LoginResponse | null
}
