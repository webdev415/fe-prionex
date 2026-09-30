/** A chain step, as far as reading a recorded value is concerned. */
export interface StepKeyLike {
  step_order: number
  target_action_id: number
}

/**
 * May this step's value be read from the legacy `target_action_id` key?
 *
 * `step_data` is keyed by `step_order`. Rows written before that convention are
 * keyed by `target_action_id`, and reading falls back to it so they keep
 * displaying — but the two are small integers in one flat key namespace, so the
 * fallback is only sound when the key names this step and nothing else. Two
 * ways it can name something else, and both must be excluded:
 *
 *  - **Another step sits at that order.** A skipped step then borrows the value
 *    of whichever step's order equals its action id — in practice the step
 *    after it, which is what made a value look shifted by one row (KAN-1090).
 *  - **Another step uses the same action.** Both steps read the one key and
 *    display the same value twice, asserting an answer neither recorded — e.g.
 *    a phone surfacing in an empty loan field (KAN-744).
 *
 * This is the single place that decision is made; every reader of a recorded
 * value defers to it, so the two rules cannot drift apart.
 */
export function legacyKeyIsUnambiguous(
  step: StepKeyLike,
  chainSteps: readonly StepKeyLike[]
): boolean {
  const sharesTargetAction =
    chainSteps.filter((s) => s.target_action_id === step.target_action_id).length > 1
  const namesAnotherStepsOrder = chainSteps.some(
    (s) => s.step_order === step.target_action_id && s.step_order !== step.step_order
  )
  return !sharesTargetAction && !namesAnotherStepsOrder
}

/**
 * The value recorded for one step of a chain.
 *
 * Prefers the step's own `step_order` key and falls back to the legacy
 * `target_action_id` one only where that key is unambiguous. An empty string is
 * a recorded answer, not a missing one, so it is returned rather than falling
 * through — otherwise a step answered blank would borrow a neighbour's value.
 */
export function readStepValue(
  stepData: Record<string, unknown> | null | undefined,
  step: StepKeyLike,
  chainSteps: readonly StepKeyLike[]
): unknown {
  if (!stepData) return undefined

  const own = stepData[String(step.step_order)]
  if (own !== undefined) return own

  if (!legacyKeyIsUnambiguous(step, chainSteps)) return undefined

  return stepData[String(step.target_action_id)]
}
