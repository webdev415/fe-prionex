import { describe, it, expect, beforeEach } from 'vitest'
import { useEffect } from 'react'
import { render, act } from '@testing-library/react'

import { useCanShowIncomingPopup } from '../useCanShowIncomingPopup'
import { useCallStore } from '@/stores/callStore'

/**
 * Stands in for `CallDialogModal`, which registers itself in the store from a
 * mount effect. React runs child effects before parent ones, so this is what
 * makes the popup capable of suppressing itself.
 */
function Popup() {
  const setOpenCallModal = useCallStore((s) => s.setOpenCallModal)
  useEffect(() => {
    setOpenCallModal('call-dialog')
  }, [setOpenCallModal])
  return <div data-testid="popup" />
}

function Layout({ callId }: { callId: string | null }) {
  const canShow = useCanShowIncomingPopup(callId)
  return <>{callId && canShow && <Popup />}</>
}

describe('useCanShowIncomingPopup', () => {
  beforeEach(() => {
    localStorage.clear()
    useCallStore.setState({ minimizedCall: null, openCallModal: null })
  })

  it('shows the popup when the operator has no call window', () => {
    const { queryByTestId } = render(<Layout callId="c1" />)

    // The popup registers itself in the store on mount. If the decision were
    // taken after it could render, it would read that and hide the very popup
    // that wrote it.
    expect(queryByTestId('popup')).not.toBeNull()
  })

  it('keeps showing it once its own registration has landed', () => {
    const { queryByTestId } = render(<Layout callId="c1" />)

    expect(useCallStore.getState().openCallModal).toBe('call-dialog')
    expect(queryByTestId('popup')).not.toBeNull()
  })

  it('hides the popup when a call is genuinely in progress', () => {
    useCallStore.getState().setOpenCallModal('call-dialog')

    const { queryByTestId } = render(<Layout callId="c1" />)

    expect(queryByTestId('popup')).toBeNull()
  })

  it('hides it when a call is minimized and still live', () => {
    useCallStore.getState().setMinimizedCall({
      id: 'm1',
      type: 'call-dialog',
      clientName: 'X',
      phoneNumber: '380000000000',
      callId: 'other',
      callState: 'connected',
      timestamp: Date.now(),
    })

    const { queryByTestId } = render(<Layout callId="c1" />)

    expect(queryByTestId('popup')).toBeNull()
  })

  it('shows the next call after the previous popup was dismissed', () => {
    const { queryByTestId, rerender } = render(<Layout callId="c1" />)
    expect(queryByTestId('popup')).not.toBeNull()

    act(() => rerender(<Layout callId={null} />))
    act(() => rerender(<Layout callId="c2" />))

    // The popup is unmounted rather than closed, so nothing clears the
    // registration it made. Left behind, it would suppress every later call
    // for the rest of the session.
    expect(queryByTestId('popup')).not.toBeNull()
  })

  it('shows a second call that arrives while the first is still ringing', () => {
    const { queryByTestId, rerender } = render(<Layout callId="c1" />)
    expect(queryByTestId('popup')).not.toBeNull()

    // A queue can replace one ringing call with another without ever passing
    // through "no call" — and React batches "c1 ended, c2 arrived" into a
    // single render. The registration c1's popup made must not decide against
    // its own successor.
    act(() => rerender(<Layout callId="c2" />))

    expect(queryByTestId('popup')).not.toBeNull()
  })

  it('still hides a second call when a real call window is open', () => {
    const { queryByTestId, rerender } = render(<Layout callId="c1" />)
    useCallStore.getState().setMinimizedCall({
      id: 'm1',
      type: 'call-dialog',
      clientName: 'X',
      phoneNumber: '380000000000',
      callId: 'c1',
      callState: 'connected',
      timestamp: Date.now(),
    })

    act(() => rerender(<Layout callId="c2" />))

    // The operator minimized the first call and is on it; the discount above
    // must not wave a second popup through.
    expect(queryByTestId('popup')).toBeNull()
  })

  it('gives the registration back when it unmounts', () => {
    const { unmount } = render(<Layout callId="c1" />)
    expect(useCallStore.getState().openCallModal).toBe('call-dialog')

    unmount()

    // Otherwise logging out or navigating away leaves a registration that
    // blocks every outbound call button with nothing on screen.
    expect(useCallStore.getState().openCallModal).toBeNull()
  })

  it('leaves a real call window alone when the popup goes away', () => {
    const { rerender } = render(<Layout callId="c1" />)
    useCallStore.getState().setMinimizedCall({
      id: 'm1',
      type: 'call-dialog',
      clientName: 'X',
      phoneNumber: '380000000000',
      callId: 'c1',
      callState: 'connected',
      timestamp: Date.now(),
    })

    act(() => rerender(<Layout callId={null} />))

    // The operator minimized this call rather than dropping it; clearing the
    // window here would lose the call they are still on.
    expect(useCallStore.getState().openCallModal).toBe('call-dialog')
  })
})
