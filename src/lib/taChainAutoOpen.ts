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
    (inst) => inst.status === 'active' && inst.started_by == null && !seenIds.has(inst.id)
  )
  if (!launched) return NO_OP

  // Found it. If the modal isn't showing yet, open it and stay armed (retry).
  // If it's already showing, we're done — disarm.
  return isExecutorOpen ? { open: false, disarm: true } : { open: true, disarm: false }
}
