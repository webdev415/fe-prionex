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
 * The single instance, as a promise. Also the guard against a second start:
 * `StrictMode` runs effects twice in development, and two `new Tracker().start()`
 * calls mean two sessions for one page load.
 *
 * It resolves to `null` when the tracker is disabled, refused to start, or threw
 * — callers must handle that, which is why the type says so.
 */
let trackerPromise: Promise<Tracker | null> | null = null

/** The started tracker, or `null`. Used by the code that identifies the operator. */
export function getTracker(): Promise<Tracker | null> {
  return trackerPromise ?? Promise.resolve(null)
}

export function startOpenReplay(): void {
  if (!OPENREPLAY_ENABLED || trackerPromise) return

  trackerPromise = import('@openreplay/tracker')
    .then(async ({ default: OpenReplayTracker }) => {
      const tracker = new OpenReplayTracker({
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
          ignoreHeaders: ['cookie', 'set-cookie', 'authorization'],
          sessionTokenHeader: false,
          failuresOnly: false,
          captureInIframes: true,

          // Bodies are not captured and those three headers are dropped, but
          // neither of those touches the URL — and a URL is where this codebase
          // actually carries a credential. The sanitizer runs before the record
          // is sent and its return value replaces it, so redacting here means the
          // secret never leaves the browser. See SENSITIVE_QUERY_PARAMS above for
          // what this does and does not cover today.
          sanitizer: (data) => {
            data.url = redactSensitiveQueryParams(data.url)
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
