import { useEffect, useRef, useState } from 'react'

import { useCallStore } from '@/stores/callStore'

/**
 * Whether the incoming-call popup for `callId` must stay hidden because the
 * operator already has a call window — "one call window at a time".
 *
 * Returns `null` until the answer is known; callers must render the popup only
 * on an explicit `false`.
 *
 * The answer is taken **during render**, deliberately. The popup registers
 * itself in the store from its own mount effect, and React runs child effects
 * before parent ones — so a decision taken in an effect reads the store the
 * popup has just written and hides the very popup that wrote it. Deciding
 * before anything can render keeps the popup out of its own input.
 *
 * Latched per call: re-deciding later would hit the same problem one render on.
 */
export function useIncomingPopupSuppression(callId: string | null | undefined): boolean | null {
  const [decided, setDecided] = useState<{ callId: string; suppressed: boolean } | null>(null)

  if (callId && decided?.callId !== callId) {
    setDecided({ callId, suppressed: useCallStore.getState().isCallWindowLive() })
  } else if (!callId && decided) {
    setDecided(null)
  }

  const suppressed = callId && decided?.callId === callId ? decided.suppressed : null
  const shownFor = useRef<string | null>(null)

  useEffect(() => {
    if (callId && suppressed === false) {
      shownFor.current = callId
      return
    }
    if (callId || !shownFor.current) return
    shownFor.current = null
    // The popup is unmounted rather than closed — its consumer drops it from
    // the tree — so the modal's own "clear on close" effect never runs, and the
    // registration it made would stay behind and suppress every later call for
    // the rest of the session. Undo only what showing it caused, and only while
    // no other window has taken over.
    const store = useCallStore.getState()
    if (!store.minimizedCall) store.setOpenCallModal(null)
  }, [callId, suppressed])

  return suppressed
}
