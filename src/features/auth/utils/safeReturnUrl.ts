/**
 * URL preservation across logout / session-expiry / re-auth.
 *
 * Captures the current pathname + search so operators can resume where
 * they left off after re-authenticating. Strict validation prevents
 * open-redirect attacks (returnUrl=https://evil.com would otherwise let
 * a phisher bounce users off-site post-login).
 */

const DEFAULT_PATH = '/dashboard'

/**
 * Paths from which we should NOT capture a returnUrl (would create a
 * redirect loop or skip required flows).
 */
const NON_CAPTURABLE_PATHS = ['/login', '/change-password']

/**
 * Validate a candidate returnUrl. Returns the safe URL to navigate to.
 * Falls back to DEFAULT_PATH if the candidate is missing or unsafe.
 *
 * Rules (all must pass):
 *   1. Must be a non-empty string
 *   2. Must start with '/'
 *   3. Must NOT start with '//' (protocol-relative URL — browsers treat
 *      as external)
 *   4. Must NOT start with '/\\' (backslash trick)
 *   5. Must NOT contain ':' in the path portion (blocks scheme injection
 *      attempts like javascript: or data: that survive URL decoding)
 *   6. Must NOT route to /login or /change-password (would loop)
 */
export function safeReturnUrl(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_PATH
  if (typeof raw !== 'string') return DEFAULT_PATH
  if (raw.length === 0) return DEFAULT_PATH

  if (!raw.startsWith('/')) return DEFAULT_PATH
  if (raw.startsWith('//')) return DEFAULT_PATH
  if (raw.startsWith('/\\')) return DEFAULT_PATH

  // Reject any ':' in the path portion (before the first query/hash) to
  // block scheme-injection attempts that survive URL-decoding.
  const pathOnly = raw.split('?')[0].split('#')[0]
  if (pathOnly.includes(':')) return DEFAULT_PATH

  for (const blocked of NON_CAPTURABLE_PATHS) {
    if (pathOnly === blocked || pathOnly.startsWith(blocked + '/')) {
      return DEFAULT_PATH
    }
  }

  return raw
}

/**
 * Build the URL to navigate to when forcing the user to the login page,
 * preserving the current location as a ``returnUrl`` query parameter.
 *
 * Skips the capture if the user is already on a non-capturable path
 * (returning a bare '/login' to avoid loops).
 *
 * Uses ``window.location`` so it works both inside React Router
 * (manual logout) and inside the axios interceptor (session expiry —
 * no router context available there).
 */
export function buildLoginUrlWithReturn(): string {
  const path = window.location.pathname
  for (const blocked of NON_CAPTURABLE_PATHS) {
    if (path === blocked || path.startsWith(blocked + '/')) {
      return '/login'
    }
  }
  const current = window.location.pathname + window.location.search
  return `/login?returnUrl=${encodeURIComponent(current)}`
}
