import { useEffect, useRef } from 'react'
import type { useTrackEvent } from '@/features/operatorAnalytics'

type TrackEvent = ReturnType<typeof useTrackEvent>

function toClientId(id: string): number | null {
  const numericId = Number(id)
  return Number.isFinite(numericId) ? numericId : null
}

/**
 * Records the card tab or section on screen: once per change, and once when a
 * card loads.
 *
 * A tab-keyed effect also runs on mount, and again when the card switches to
 * another client without remounting — both with a tab the operator never
 * clicked. The event still has to fire then, because screen-time derives its
 * per-tab durations purely from this stream: one event opens a tab window and
 * the next one closes it, so dropping the mount event would both lose all
 * time spent on the default tab and leave the previous card's window open
 * across the switch. It is marked `initial` instead, so consumers that want
 * deliberate choices only (the client activity feed) can skip it while
 * screen-time keeps the boundaries it needs.
 *
 * Used for the card tabs (`client_card_tab_switch`, meta `tab`) and for the
 * main card sections — Loans, Payments, Recommenders, Operators, Calls/SMS,
 * Tasks, Docs (`client_card_section_open`, meta `section`).
 */
export function useCardSelectionTracking(
  eventType: 'client_card_tab_switch' | 'client_card_section_open',
  metaKey: 'tab' | 'section',
  id: string | undefined,
  selected: string,
  trackEvent: TrackEvent
): void {
  const lastTracked = useRef<{ id: string; selected: string } | null>(null)

  useEffect(() => {
    if (!id) return
    const previous = lastTracked.current
    lastTracked.current = { id, selected }
    // A re-run with an unchanged selection for the same client is neither a
    // click nor a card load — `trackEvent` is a useCallback and its identity
    // can change.
    if (previous && previous.id === id && previous.selected === selected) return
    const isInitial = !previous || previous.id !== id
    trackEvent(eventType, {
      clientId: toClientId(id),
      meta: { [metaKey]: selected, ...(isInitial ? { initial: true } : {}) },
    })
  }, [eventType, metaKey, selected, id, trackEvent])
}

/**
 * Records every other modal in the card being opened.
 *
 * The ones that change data leave an audit entry when they succeed, but a form
 * opened and abandoned leaves no trace at all — that gap is what this closes.
 * Driven off the open flags in one place rather than ~15 call sites, so a
 * modal added later needs one map line.
 *
 * A separate type from interaction_form_*: those feed screen-time's "avg form
 * submit", and folding fifteen more modals into that average would quietly
 * redefine the metric. The modal is named in meta so per-modal timings stay
 * possible later without another schema change.
 */
export function useModalOpenTracking(
  id: string | undefined,
  modalOpenFlags: Record<string, boolean>,
  trackEvent: TrackEvent
): void {
  const previousModalOpenFlags = useRef<Record<string, boolean> | null>(null)

  useEffect(() => {
    if (!id) return
    const previous = previousModalOpenFlags.current
    previousModalOpenFlags.current = modalOpenFlags
    // First run records the baseline only — nothing was "opened" by anyone yet.
    if (!previous) return
    for (const [modal, isOpen] of Object.entries(modalOpenFlags)) {
      if (isOpen && !previous[modal]) {
        trackEvent('client_modal_open', {
          clientId: toClientId(id),
          meta: { modal },
        })
      }
    }
  }, [modalOpenFlags, id, trackEvent])
}

/**
 * Records the interaction form (the chain executor) being opened.
 *
 * Tracked in one place rather than at each call site because it is opened from
 * several (header button, phone rows, the auto-open effect). Open only, like
 * every other modal — the save itself is already recorded by audit-service, in
 * more detail than an event here could carry.
 */
export function useInteractionFormOpenTracking(
  id: string | undefined,
  isOpen: boolean,
  trackEvent: TrackEvent
): void {
  const interactionFormWasOpen = useRef(false)

  useEffect(() => {
    if (!id) return
    if (!isOpen) {
      interactionFormWasOpen.current = false
      return
    }
    // Emit on the closed -> open transition only. `trackEvent` is a useCallback
    // with its own dependencies, so this effect can re-run while the form stays
    // open; without the guard that would double-count opens.
    if (interactionFormWasOpen.current) return
    interactionFormWasOpen.current = true
    trackEvent('interaction_form_open', { clientId: toClientId(id) })
  }, [isOpen, id, trackEvent])
}
