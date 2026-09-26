import axios from 'axios'
import type { TFunction } from 'i18next'
import { getErrorMessage, getErrorStatus, translateErrorCode } from '@/lib/errors'
import type { AppLoginDevice, AppLoginStatus } from '../types'

/** Deep link the phone opens from the QR; the host is the stand the code belongs to. */
export const PAIRING_URL_SCHEME = 'prionexhub://app-login/pair'

/** Default device cap from the design (`AUTH_APP_LOGIN_MAX_DEVICES=3`). */
export const DEFAULT_MAX_DEVICES = 3

/** Pairing code lifetime from the design, used when the API does not send a usable one. */
export const DEFAULT_PAIRING_TTL_S = 300

/**
 * The code's lifetime in seconds as the screen can count with it. A missing,
 * non-numeric, zero or negative `expires_in` would turn the countdown into
 * `NaN:NaN` and the poll deadline into `NaN` (no poll at all), so it falls back
 * to the design value; the server still enforces the real TTL.
 */
export function pairingTtlSeconds(expiresIn: unknown): number {
  return typeof expiresIn === 'number' && Number.isFinite(expiresIn) && expiresIn > 0
    ? expiresIn
    : DEFAULT_PAIRING_TTL_S
}

/**
 * `ABCDEFGH` → `ABCD-EFGH`. The code is 8 Crockford characters; anything that
 * does not look like that is shown as given rather than guessed at.
 */
export function formatPairingCode(code: string): string {
  const clean = code.replace(/[\s-]/g, '').toUpperCase()
  if (clean.length !== 8) return code
  return `${clean.slice(0, 4)}-${clean.slice(4)}`
}

/**
 * The deep link from the API, or null. The link goes into an `href`, so only
 * the one scheme and path the phone understands is let through — anything
 * else (a `javascript:` URL, a web page) is dropped rather than rendered.
 *
 * There is deliberately no client-side fallback: the API's `e=` is the
 * server's ENVIRONMENT name (`development`, `production`…), which the browser
 * cannot know; a link guessed from `window.location.host` would carry a stand
 * id the phone does not recognise.
 */
export function safePairingUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null
  return url.startsWith(`${PAIRING_URL_SCHEME}?`) ? url : null
}

/** Seconds → `m:ss`, never negative. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * The feature is off when the flag makes every app-login route answer 404,
 * or when the status read says `feature_available=false`.
 */
export function isFeatureOffError(error: unknown): boolean {
  return getErrorStatus(error) === 404
}

export function isFeatureAvailable(status: AppLoginStatus | undefined): boolean {
  return status?.feature_available === true
}

/** Extra attempts for a status read that failed for a reason worth retrying. */
export const STATUS_READ_RETRIES = 2

/**
 * react-query `retry` for the status read. A 404 is the answer «the feature is
 * off», and any other 4xx (a refusal, 429) would only be refused again, so
 * neither is retried; a network failure or a 5xx is retried a couple of times
 * before the section shows its error line.
 */
export function retryStatusRead(failureCount: number, error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status !== null && status >= 400 && status < 500) return false
  return failureCount < STATUS_READ_RETRIES
}

export function activeDevices(status: AppLoginStatus | undefined): AppLoginDevice[] {
  return status?.devices ?? []
}

/**
 * A device that appeared after the pairing code was issued — the moment the
 * phone finished enrollment. Compared by id, not by count, so a device that
 * was unbound meanwhile does not hide the new one.
 */
export function findNewDevice(
  baselineIds: ReadonlySet<string>,
  status: AppLoginStatus | undefined
): AppLoginDevice | null {
  return activeDevices(status).find((device) => !baselineIds.has(device.id)) ?? null
}

export function platformLabel(platform: string): string {
  if (platform === 'ios') return 'iOS'
  if (platform === 'android') return 'Android'
  return platform
}

/**
 * The one name a bound phone goes by everywhere — the device list, the
 * «connected» banner, the unbind question and its toast: the label the phone
 * reported, or «Phone» when it reported none.
 */
export function deviceLabel(device: Pick<AppLoginDevice, 'label'>, t: TFunction<'auth'>): string {
  const label = typeof device.label === 'string' ? device.label.trim() : ''
  return label || t('appLogin.devices.unnamed')
}

/** The machine code of an auth-service refusal (`{detail: {code}}` or `{code}`), if any. */
export function refusalCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null
  const data = error.response?.data as Record<string, unknown> | undefined
  const detail = data?.detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const { code } = detail as { code?: unknown }
    if (typeof code === 'string' && code) return code
  }
  return typeof data?.code === 'string' && data.code ? data.code : null
}

/**
 * The reason a password check was refused, as the person should read it.
 * auth-service answers either `{detail: "...", code}` or, like the 2FA and
 * app-login routes, `{detail: {code, message}}`; a bare 401 must not turn into
 * the generic «please sign in again», because the session is fine — the
 * password is not.
 *
 * `byCode` maps the codes the caller knows to its own localized text: the
 * app-login routes answer in English (`INVALID_CREDENTIALS` → "Invalid
 * password") and `errors.json` has no entries for them, so without the map a
 * Ukrainian profile would show the English server string.
 */
export function passwordRefusalMessage(
  error: unknown,
  fallback: string,
  byCode: Readonly<Record<string, string>> = {}
): string {
  if (!axios.isAxiosError(error)) return fallback
  const code = refusalCode(error)
  if (code !== null && Object.prototype.hasOwnProperty.call(byCode, code) && byCode[code]) {
    return byCode[code]
  }
  const data = error.response?.data as Record<string, unknown> | undefined
  const detail = data?.detail
  if (typeof detail === 'string' && detail) {
    return translateErrorCode(data?.code, detail, data?.params)
  }
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const { message } = detail as { message?: unknown }
    if (typeof message === 'string' && message) return translateErrorCode(code, message)
  }
  return fallback
}

/**
 * Any other refusal of an app-login route (unbind, admin revoke-all, status).
 * `getErrorMessage` does not read the `{detail: {code, message}}` shape and
 * would fall to a generic «Resource not found.»; this reads it first.
 */
export function appLoginErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as Record<string, unknown> | undefined)?.detail
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const { message } = detail as { message?: unknown }
      if (typeof message === 'string' && message) {
        return translateErrorCode(refusalCode(error), message)
      }
    }
  }
  return getErrorMessage(error) || fallback
}
