/**
 * Per-navigation tab tracking + close-event DELETE.
 *
 * This hook is mounted INSIDE the React Router tree (in
 * DashboardLayoutRoute) so that `useLocation()` resolves. Mounting it
 * in App.tsx (outside RouterProvider) would throw.
 *
 * Two responsibilities:
 *   1. Maintain a single tab_id per browser tab (window.name +
 *      sessionStorage). Each visible tab has a distinct id, so its
 *      navigation writes update a unique field in Redis.
 *   2. On every navigation in this tab, PUT the URL to the BE so the
 *      server's Redis HASH is kept fresh.
 *   3. On tab close, fire a sendBeacon POST that deletes this tab's
 *      field from Redis. This is unconditional — every close DELETEs.
 *
 * Trade-off accepted by this design:
 *   - Closing the browser with N authenticated tabs DELETEs all N
 *     fields. Next-login modal will not appear unless the user crashed
 *     or force-quit the browser (in which case beforeunload doesn't
 *     fire and the snapshot is preserved by accident).
 *   - Single tab close behaves cleanly: that tab's URL is deleted,
 *     other tabs keep theirs.
 *
 * Excluded paths (/login, /change-password) do not receive per-nav PUTs
 * but the close handler still fires for them (no flag to consult).
 * In practice the close handler is a no-op for excluded paths because
 * either the user logged out (token cleared → sendBeacon skipped) or
 * the JWT expired (BE rejects with 401).
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { upsertTabUrl } from '@/features/auth/api/tabSessionApi'
import { getAccessToken } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const TAB_ID_KEY = 'tabSession_tab_id'
const TAB_ID_WINDOW_NAME_PREFIX = 'tabSession_tab:'

const EXCLUDED_PATHS = ['/login', '/change-password']

function isExcluded(pathname: string): boolean {
  for (const blocked of EXCLUDED_PATHS) {
    if (pathname === blocked || pathname.startsWith(blocked + '/')) return true
  }
  return false
}

function getOrCreateTabId(): string {
  // window.name is per-tab and is NOT inherited when a tab is opened
  // via window.open(url, '_blank'), unlike sessionStorage which IS
  // inherited (per WHATWG HTML spec). Using window.name as the canonical
  // identity anchor ensures Restore Session and other window.open paths
  // produce distinct tab_ids instead of all writing to the same Redis
  // field.
  //
  // Resolution order:
  //   1. window.name already has our prefix → trust it (same tab after
  //      navigation, reload, or Ctrl+Shift+T reopen — window.name
  //      survives all three).
  //   2. window.opener truthy → this tab was opened via window.open;
  //      sessionStorage was inherited from the parent and is
  //      untrustworthy. Generate a fresh UUID.
  //   3. Otherwise (fresh tab, no opener — Ctrl+T, pasted URL, etc.):
  //      reuse sessionStorage if present (recovers from a cross-site
  //      nav that may have cleared window.name), else generate.
  //   4. Mirror the chosen id into BOTH window.name and sessionStorage
  //      so either can recover the other.
  if (typeof window !== 'undefined' && window.name?.startsWith(TAB_ID_WINDOW_NAME_PREFIX)) {
    const id = window.name.slice(TAB_ID_WINDOW_NAME_PREFIX.length)
    sessionStorage.setItem(TAB_ID_KEY, id)
    return id
  }

  const isWindowOpenChild = typeof window !== 'undefined' && !!window.opener
  let tabId: string | null = null
  if (!isWindowOpenChild) {
    tabId = sessionStorage.getItem(TAB_ID_KEY)
  }

  if (!tabId) {
    tabId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : // Fallback for older environments / jsdom test runs.
          'tab-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
  }

  sessionStorage.setItem(TAB_ID_KEY, tabId)
  if (typeof window !== 'undefined') {
    window.name = TAB_ID_WINDOW_NAME_PREFIX + tabId
  }
  return tabId
}

export function useTabTracker(): void {
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // 1. Per-navigation HSET — fires on every React Router URL change.
  // Skipped for excluded paths (/login, /change-password).
  useEffect(() => {
    if (!isAuthenticated) return
    if (isExcluded(location.pathname)) return

    const tabId = getOrCreateTabId()
    const url = location.pathname + location.search + location.hash

    // Silent fail — per-nav writes are best-effort. If Redis is down,
    // the snapshot just doesn't get updated; the user notices nothing.
    upsertTabUrl(tabId, url).catch(() => {
      /* swallow */
    })
  }, [isAuthenticated, location])

  // 2. Close-event handler — fires sendBeacon DELETE unconditionally
  // for any authenticated close. There is no client-side counter to
  // distinguish single-tab close from browser close: every close
  // DELETEs.
  //
  // Why sendBeacon: it is the only browser API explicitly guaranteed
  // to deliver as the page unloads. fetch() with keepalive: true was
  // observed to be silently dropped during unload in Chrome.
  // sendBeacon only supports POST, so the JWT goes in the request body
  // instead of the Authorization header.
  useEffect(() => {
    if (!isAuthenticated) return

    // Idempotency guard — both beforeunload and pagehide fire on tab
    // close in modern browsers. Without this, handleClose runs twice
    // and fires two DELETEs.
    let closeHandled = false

    const handleClose = () => {
      if (closeHandled) return
      closeHandled = true

      const tabId = sessionStorage.getItem(TAB_ID_KEY)
      if (!tabId) return

      // Token guard — after a logout the token is cleared from
      // localStorage. Skipping sendBeacon here keeps the snapshot
      // preserved across logout-then-close. Without this guard the
      // edge case of "manual navigate to /login while authenticated
      // then close" still deletes the field; that is an accepted
      // limitation of this design.
      const token = getAccessToken()
      if (!token) return

      const apiBase =
        import.meta.env.VITE_API_BASE_URL !== undefined
          ? import.meta.env.VITE_API_BASE_URL
          : 'http://localhost:8000'
      const body = new Blob([JSON.stringify({ token })], {
        type: 'application/json',
      })
      try {
        navigator.sendBeacon(`${apiBase}/api/v1/auth/me/tabs/${tabId}/close`, body)
      } catch {
        // Beacon API unavailable or the user agent rejected the
        // payload — best effort; the field stays in Redis until the
        // user clicks Start Fresh on next login or the 5-day TTL
        // expires.
      }
    }

    window.addEventListener('beforeunload', handleClose)
    window.addEventListener('pagehide', handleClose)
    return () => {
      window.removeEventListener('beforeunload', handleClose)
      window.removeEventListener('pagehide', handleClose)
    }
  }, [isAuthenticated])
}
