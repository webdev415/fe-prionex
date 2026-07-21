/**
 * Operator dialer socket (KAN-379) — routed live-call stream.
 *
 * ⚠️ STUB. The transport and event contract for routed live calls depend on the
 * telephony/AMD stack decision that is still open (plan §7.1 — Voximplant vs
 * Asterisk vs FreeSWITCH). Until that is confirmed with the dev team, this hook
 * exposes the routed-call shape the UI consumes but does not yet subscribe to a
 * real socket.
 *
 * When the contract is confirmed, wire a socket here (mirroring
 * `features/calls/hooks/useCallWebSocket.ts`) and drive `routedCall` from the
 * dialer's routed-call / call-ended events, and `queueComplete` from the
 * queue-completed notification (ticket §6.1).
 */

import { useCallback, useState } from 'react'

import type { RoutedCall } from '../types'

export interface DialerSocketState {
  /** The live call currently bridged to this operator, or null. */
  routedCall: RoutedCall | null
  /** True once the whole queue has been dialed through (ticket §6.1). */
  queueComplete: boolean
  /** Clear the current routed call (e.g. after hang-up / wait-time). */
  clearRoutedCall: () => void
}

export function useDialerSocket(_queueId: number | null): DialerSocketState {
  // TODO(KAN-379 §7.1): subscribe to the dialer routed-call socket here and
  // replace this local state with live events. Kept as state (not a constant)
  // so the wiring is a drop-in once the event contract is confirmed.
  const [routedCall, setRoutedCall] = useState<RoutedCall | null>(null)
  const [queueComplete] = useState(false)

  const clearRoutedCall = useCallback(() => setRoutedCall(null), [])

  return { routedCall, queueComplete, clearRoutedCall }
}
