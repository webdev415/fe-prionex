/**
 * Decision logic for auto-opening a trigger-launched TA chain modal after the
 * operator changes a debt's status (close → `closed`, reopen → `active`).
 *
 * Extracted as a pure function so the behaviour is unit-testable without a
 * browser — in particular the "retry until shown" property that makes the pop
 * survive the operator clicking around during the ~1.5-3s wait while the chain
 * is created asynchronously by the chain event consumer.
 */

/** Minimal shape the decision needs from a chain instance. */
export interface ChainInstanceLite {
  id: number
  status: string
  /** null ⇒ system/trigger-launched; a user id ⇒ started by hand. */
  started_by: number | null
  /**
   * Visibility = "System (hidden)" on the instance's chain (KAN-1045).
   * Optional: a response from a server without that field omits it, which
   * degrades to the previous behaviour rather than to a panel that never opens.
   */
  is_system_hidden?: boolean
}

export interface ChainAutoOpenDecision {
  /** Open the chain executor modal now. */
  open: boolean
  /** Stop arming/polling — we're done. */
  disarm: boolean
}

const NO_OP: ChainAutoOpenDecision = { open: false, disarm: false }

/**
 * Decide what to do on each poll/render while "armed" (i.e. THIS operator just
 * changed a debt status and we're waiting for the launched chain to appear).
 *
 * The launched chain is the one that is: active, system-started
 * (`started_by == null`), and brand new — its id was NOT present when the
 * status change was made (`seenIds`), so a stale/unrelated chain can't pop.
 *
 * A System (hidden) chain is excluded even though it fits that description
 * exactly — it is active and system-started, because a trigger launched it
 * (KAN-1045). KAN-318 says such a chain must never be surfaced to a user, and
 * the damage is not only the stray modal: this search stops at the first
 * match and disarms, so a hidden instance appearing inside the wait window
 * would consume the pop that the operator's own debt-status chain was owed.
 *
 * Retry-until-shown: when the launched chain is found but the executor isn't
 * open yet, we return `{ open: true, disarm: false }` — open it but STAY armed.
 * We only disarm once the executor is actually open. So if a click elsewhere in
 * the wait window perturbs state and the open doesn't take on one tick, the next
 * poll tries again instead of giving up — the pop can't be silently lost.
 */
export function decideChainAutoOpen(params: {
  armed: boolean
  instances: ReadonlyArray<ChainInstanceLite> | undefined
  seenIds: ReadonlySet<number>
  isExecutorOpen: boolean
}): ChainAutoOpenDecision {
  const { armed, instances, seenIds, isExecutorOpen } = params
  if (!armed || !instances) return NO_OP

  const launched = instances.find(
    (inst) =>
      inst.status === 'active' &&
      inst.started_by == null &&
      !inst.is_system_hidden &&
      !seenIds.has(inst.id)
  )
  if (!launched) return NO_OP

  // Found it. If the modal isn't showing yet, open it and stay armed (retry).
  // If it's already showing, we're done — disarm.
  return isExecutorOpen ? { open: false, disarm: true } : { open: true, disarm: false }
}
