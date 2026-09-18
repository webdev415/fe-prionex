import {
  OPENREPLAY_ENABLED,
  OPENREPLAY_INGEST_URL,
  OPENREPLAY_PRIVATE_MODE,
  OPENREPLAY_PROJECT_KEY,
} from './config'
import type Tracker from '@openreplay/tracker'

/**
 * OpenReplay session replay — the one place the tracker is created and started.
 *
 * The package is pulled in with a dynamic `import()` so that a build with no
 * project key never downloads it: the chunk is simply not requested. It also
 * keeps ~84KB (gzipped) of tracker off the critical path of the first render.
 */

/**
 * Query parameters whose value must never reach a recording.
 *
 * The one that exists today is `token`: `features/aiAssistant/transcribeSocket.ts`
 * puts the operator's JWT in the transcription socket's query string, because a
 * browser WebSocket cannot send an Authorization header. A bearer token in a
 * replay would be usable by anyone with access to it, and would survive in the
 * replay backend's backups.
 *
 * ⚠️ Read this before relying on it: as of 18.0.6 the tracker does NOT capture
 * that socket. Its network capture is `@openreplay/network-proxy`, which exports
 * `BeaconProxy`, `FetchProxy` and `XHRProxy` and nothing for WebSocket — which is
 * also why the package offers a manual `trackWs()` at all. So this list closes no
 * leak that exists right now; it is here so that the day a token appears in a
 * fetch or XHR URL, or the day the proxy grows WebSocket support, the value is
 * already redacted instead of being discovered in a recording afterwards.
 */
const SENSITIVE_QUERY_PARAMS =
  /([?&](?:access_token|api_key|apikey|auth|jwt|key|password|secret|sig|signature|token)=)[^&#]*/gi

/** Replace the value of every sensitive query parameter, leaving the URL readable. */
export function redactSensitiveQueryParams(url: string): string {
  return typeof url === 'string' ? url.replace(SENSITIVE_QUERY_PARAMS, '$1[REDACTED]') : url
}

/**
 * Headers that must never reach a recording, lower-cased.
 *
 * 🔴 Headers are captured INDEPENDENTLY of `capturePayload` — that option gates
 * bodies, which is exactly why `ignoreHeaders` exists as a separate one. So a
 * credential in a header is recorded unless it is named here.
 *
 * Beyond the package's own three, this codebase sends a fourth:
 * `features/credit/api/creditApi.ts` attaches `X-Internal-Api-Key` (the stand key
 * the operator pastes into the credit panel) to every credit-service request.
 *
 * On case: the package matches with `Array.includes`, so the comparison is
 * case-SENSITIVE, and its own defaults are lower-case. That works here because
 * axios lower-cases header names before handing them to `setRequestHeader`
 * (`AxiosHeaders` normalises via `String(header).trim().toLowerCase()`), and both
 * `Headers` iteration and `getAllResponseHeaders()` are lower-case by spec. The
 * sanitizer below nevertheless compares case-insensitively, so a caller that
 * bypasses axios cannot slip a credential through on capitalisation alone.
 */
const SENSITIVE_HEADERS = [
  'cookie',
  'set-cookie',
  'authorization',
  'proxy-authorization',
  'x-internal-api-key',
  'x-api-key',
]

const SENSITIVE_HEADER_SET = new Set(SENSITIVE_HEADERS)

/** Blank the value of every sensitive header in place, whatever its casing. */
export function redactSensitiveHeaders(headers: Record<string, string> | undefined): void {
  if (!headers) return
  for (const name of Object.keys(headers)) {
    if (SENSITIVE_HEADER_SET.has(name.toLowerCase())) {
      headers[name] = '[REDACTED]'
    }
  }
}

/**
 * The RUNNING tracker, as a promise. Also the guard against a second start:
 * `StrictMode` runs effects twice in development, and two `start()` calls mean
 * two sessions for one page load.
 *
 * It resolves to `null` when the tracker is disabled, refused to start, or threw
 * — callers must handle that, which is why the type says so. It is `null`
 * (not a promise) while nothing is running: before the first start and after
 * `stopOpenReplay()`.
 */
let trackerPromise: Promise<Tracker | null> | null = null

/**
 * The one constructed instance, kept across stop/start.
 *
 * The tracker is built once and RESTARTED, not rebuilt: `stop()` ends the
 * session and `start()` on the same instance opens a new one. A fresh
 * `new Tracker()` per login would register a second set of DOM observers on the
 * same document, which is exactly what the single-start guard above exists to
 * prevent.
 */
let instance: Tracker | null = null

/** The started tracker, or `null`. Used by `identify.ts` to name the operator. */
export function getTracker(): Promise<Tracker | null> {
  return trackerPromise ?? Promise.resolve(null)
}

/**
 * End the current session, so that the next `startOpenReplay()` opens a new one.
 *
 * Called on logout by `identify.ts`. A session is one per tab and the tracker
 * has no way to unset its user id, so without this a logout followed by another
 * login in the same tab would attribute the WHOLE session to whoever logged in
 * last — on a shared call-centre workstation, the normal case.
 */
export function stopOpenReplay(): void {
  const running = trackerPromise
  trackerPromise = null
  if (!running) return
  // `stop()` is queued behind the start it ends. A start that is still pending
  // (the chunk is downloading) is stopped the moment it resolves, before any
  // later `startOpenReplay()`'s own chain runs — microtasks are FIFO.
  void running.then((tracker) => tracker?.stop()).catch(() => undefined)
}

export function startOpenReplay(): void {
  if (!OPENREPLAY_ENABLED || trackerPromise) return

  const construct: Promise<Tracker> = instance
    ? Promise.resolve(instance)
    : import('@openreplay/tracker').then(({ default: OpenReplayTracker }) => {
        instance = new OpenReplayTracker({
          projectKey: OPENREPLAY_PROJECT_KEY,
          ingestPoint: OPENREPLAY_INGEST_URL,

          // Strict mode — off today, see config.ts. Wired so that turning it on
          // costs a repository variable and a rebuild rather than a code change.
          privateMode: OPENREPLAY_PRIVATE_MODE,

          // Text nodes. `obscureTextNumbers` defaults to FALSE in the package and
          // is off on the project itself, so client phone numbers and loan amounts
          // would otherwise be recorded verbatim. This is the blocking one.
          obscureTextNumbers: true,
          obscureTextEmails: true,

          // Input fields. The package default is `Obscured` (the value is dropped
          // but its length is still sent); `Hidden` sends nothing at all.
          // `InputMode` is not exported by the package, so the literal is the only
          // way to say this: 0 = Plain, 1 = Obscured, 2 = Hidden.
          obscureInputNumbers: true,
          obscureInputEmails: true,
          defaultInputMode: 2,

          // Console capture is ON by default (log/info/warn/error/debug/assert) and
          // is masked by nothing except privateMode. `src/` holds ~78 `console.*`
          // calls that nobody writes with a session recorder in mind, so the module
          // is switched off entirely rather than filtered.
          consoleMethods: null,

          // Canvas snapshots are images, and images bypass every DOM-level mask.
          canvas: { disableCanvas: true },

          // Every field is spelled out because the package's own types demand it:
          // `network` is declared as full `NetworkOptions` in one place and as
          // `Partial<NetworkOptions>` in another, and the intersection makes the
          // three below required. The values ARE the package defaults, except
          // `sessionTokenHeader`, which is a decision: an `X-OpenReplay-SessionToken`
          // header on cross-origin API calls would force a preflight, and if Kong
          // does not list it in `Access-Control-Allow-Headers`, every request to the
          // API fails. Recordings are correlated by `getSessionURL()` instead.
          network: {
            capturePayload: false,

            // The same list the sanitizer uses, so the two cannot drift apart: a
            // credential added to one is covered by both. `ignoreHeaders` drops the
            // header before it is ever recorded; the sanitizer is the second line,
            // for anything that reaches the record under different casing.
            ignoreHeaders: SENSITIVE_HEADERS,
            sessionTokenHeader: false,
            failuresOnly: false,
            captureInIframes: true,

            // Bodies are not captured, but that covers neither URLs nor headers,
            // and this codebase carries credentials in both: a JWT in the
            // transcription socket's query string, and X-Internal-Api-Key on every
            // credit-service request. The sanitizer runs before the record is sent
            // and its return value replaces it, so nothing redacted here leaves the
            // browser.
            sanitizer: (data) => {
              data.url = redactSensitiveQueryParams(data.url)
              redactSensitiveHeaders(data.request?.headers)
              redactSensitiveHeaders(data.response?.headers)
              return data
            },
          },

          // 🔴 Required, not optional. The constructor checks
          // `location.protocol !== 'https:'` — localhost is NOT exempt — and
          // returns silently, after which `start()` rejects with a string about
          // doNotTrack that points nowhere near the real cause. Vite strips this
          // branch from production builds, where the stands serve over HTTPS.
          __DISABLE_SECURE_MODE: import.meta.env.DEV,
        })
        return instance
      })

  trackerPromise = construct
    .then(async (tracker) => {
      // An unsuccessful start RESOLVES with `{ success: false, reason }` — it
      // does not throw. Without this check the failure would pass unnoticed.
      const result = await tracker.start()
      if (!result.success) {
        // `console.error` rather than `.info` because the project's lint rule
        // permits only that one — and it fits: this line is reached only when a
        // developer configured a key on purpose and the start still failed.
        if (import.meta.env.DEV) {
          console.error('OpenReplay did not start:', result.reason)
        }
        return null
      }
      return tracker
    })
    // A rejection here is a plain string, not an Error, and arrives when the
    // constructor never built its app (not a browser, doNotTrack, secure mode).
    // Swallowed on purpose: a missing session recording is not worth an error
    // in front of an operator, and there is nothing they could do about it.
    .catch(() => null)
}
