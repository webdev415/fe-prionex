import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isDockEmbedSearch,
  normalizeOnexAsk,
  normalizeOnexPageContext,
  ONEX_ASK_EVENT,
  ONEX_PAGE_CONTEXT_EVENT,
  type OnexAskCommand,
  type OnexPageContext,
} from './embedContext'

/**
 * React bindings for the OneX dock contract — see `embedContext.ts` for the
 * contract itself.
 */

/**
 * True while this document was opened as the OneX dock (`?embed=dock`).
 *
 * Read straight off `window.location` rather than through `useSearchParams` on
 * purpose: the assistant page is rendered in unit tests without a Router, and
 * the flag is also needed by `DashboardLayout`. `popstate` keeps it honest for
 * back/forward; the dock itself never navigates in-app.
 */
export function useIsOnexDockEmbed(): boolean {
  const [embedded, setEmbedded] = useState(() => isDockEmbedSearch(window.location.search))

  useEffect(() => {
    const sync = () => setEmbedded(isDockEmbedSearch(window.location.search))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  return embedded
}

export interface OnexPageContextState {
  /** The page the host last published, or null when there is none to show. */
  context: OnexPageContext | null
  /** Drop the context outright — the chip's ✕. */
  clearContext: () => void
  /**
   * Drop `consumed` because a turn carrying it reached the brain — but only if
   * it is still the current context. A send is not instant: the host can
   * publish a new page while the answer streams, and that one belongs to the
   * *next* turn. Identity comparison is enough: every payload produces a fresh
   * object in {@link normalizeOnexPageContext}.
   */
  consumeContext: (consumed: OnexPageContext) => void
}

/**
 * Track the page context published by the OneX host.
 *
 * Seeds from `window.__onexPageContext` (the host publishes it before the dock
 * finishes mounting) and then follows `onex:page-context`. A payload that
 * carries nothing usable clears the context instead of leaving a stale page
 * pinned to the composer.
 */
export function useOnexPageContext(enabled: boolean): OnexPageContextState {
  // Seeded in the initializer, not in the effect: `enabled` is already correct
  // on the first render (useIsOnexDockEmbed reads the location synchronously),
  // and seeding from an effect would render the composer once without the chip
  // and once with it.
  const [context, setContext] = useState<OnexPageContext | null>(() =>
    enabled ? normalizeOnexPageContext(window.__onexPageContext) : null
  )

  useEffect(() => {
    if (!enabled) return

    const onPageContext = (event: WindowEventMap[typeof ONEX_PAGE_CONTEXT_EVENT]) => {
      setContext(normalizeOnexPageContext(event.detail))
    }
    window.addEventListener(ONEX_PAGE_CONTEXT_EVENT, onPageContext)
    return () => window.removeEventListener(ONEX_PAGE_CONTEXT_EVENT, onPageContext)
  }, [enabled])

  const clearContext = useCallback(() => setContext(null), [])
  const consumeContext = useCallback(
    (consumed: OnexPageContext) => setContext((current) => (current === consumed ? null : current)),
    []
  )

  return { context, clearContext, consumeContext }
}

/**
 * Run `onAsk` for every valid `onex:ask` command.
 *
 * The handler is held in a ref so a caller that rebuilds it on each render (it
 * closes over the composer state) does not detach and re-attach the listener,
 * which would drop a command fired in between.
 */
export function useOnexAsk(enabled: boolean, onAsk: (command: OnexAskCommand) => void): void {
  const handlerRef = useRef(onAsk)

  useEffect(() => {
    handlerRef.current = onAsk
  }, [onAsk])

  useEffect(() => {
    if (!enabled) return

    const onEvent = (event: WindowEventMap[typeof ONEX_ASK_EVENT]) => {
      const command = normalizeOnexAsk(event.detail)
      if (command) handlerRef.current(command)
    }
    window.addEventListener(ONEX_ASK_EVENT, onEvent)
    return () => window.removeEventListener(ONEX_ASK_EVENT, onEvent)
  }, [enabled])
}

/**
 * Publish `window.__onexDockReady` while the dock is mounted, so the host knows
 * its events will be heard rather than fired into a page that is still loading.
 */
export function useOnexDockReady(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    window.__onexDockReady = true
    return () => {
      window.__onexDockReady = false
    }
  }, [enabled])
}
