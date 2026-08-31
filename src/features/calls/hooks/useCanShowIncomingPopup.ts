import { useEffect, useRef, useState } from 'react'

import { useCallStore } from '@/stores/callStore'

/**
 * Give back the store registration the popup made on mount.
 *
 * Only when no other window has taken over: minimizing the popup turns it into
 * a real call window, and that one is not ours to close.
 */
function releasePopupRegistration(): void {
  const store = useCallStore.getState()
  if (!store.minimizedCall) store.setOpenCallModal(null)
}

/**
 * Whether the incoming-call popup for `callId` may be rendered.
 *
 * False until the answer is known, so an undecided state can only ever hide the
 * popup, never show one that should have been suppressed. This is returned as a
 * plain boolean rather than a tri-state on purpose: a `boolean | null` invites
 * `!suppressed`, which treats "not decided yet" as "show it" and reinstates the
 * bug below.
 *
 * The answer is taken **during render**. The popup registers itself in the
 * store from its own mount effect, and React runs child effects before parent
 * ones — so a decision taken in an effect reads the store the popup has just
 * written and hides the very popup that wrote it. Deciding before anything can
 * render keeps the popup out of its own input.
 *
 * Latched per call: re-deciding later would hit the same problem one render on.
 */
export function useCanShowIncomingPopup(callId: string | null | undefined): boolean {
  const [decided, setDecided] = useState<{ callId: string; canShow: boolean } | null>(null)

  if (callId && decided?.callId !== callId) {
    const store = useCallStore.getState()
    // A popup already on screen has registered itself in the store. A queue can
    // replace one ringing call with another without ever passing through "no
    // call", so judging the successor against our own registration would
    // suppress it — the same self-suppression this hook exists to prevent, one
    // call later. Discount it and judge against real windows only.
    const registrationIsOurs = decided !== null && decided.canShow
    setDecided({
      callId,
      canShow: registrationIsOurs ? !store.minimizedCall : !store.isCallWindowLive(),
    })
  } else if (!callId && decided) {
    setDecided(null)
  }

  const canShow =
    Boolean(callId) && decided !== null && decided.callId === callId && decided.canShow
  const shownFor = useRef<string | null>(null)

  useEffect(() => {
    if (canShow && callId) {
      shownFor.current = callId
      return
    }
    // The popup is unmounted rather than closed — its consumer drops it from
    // the tree — so the modal's own "clear on close" effect never runs, and the
    // registration it made would stay behind. Left there it suppresses every
    // later call AND keeps `isCallActive()` true, which blocks the operator
    // from starting a call with nothing on screen to explain why.
    if (!shownFor.current) return
    shownFor.current = null
    releasePopupRegistration()
  }, [callId, canShow])

  useEffect(
    () => () => {
      if (!shownFor.current) return
      shownFor.current = null
      releasePopupRegistration()
    },
    []
  )

  return canShow
}
