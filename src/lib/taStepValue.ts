/** A chain step, as far as reading a recorded value is concerned. */
export interface StepKeyLike {
  step_order: number
  target_action_id: number
}

/**
 * The value recorded for one step of a chain.
 *
 * `step_data` is keyed by `step_order`. Rows written before that convention are
 * keyed by `target_action_id`, and reading falls back to it so they keep
 * displaying — but only when the chain has no step at that order.
 *
 * Without that condition the fallback is a collision: both are small integers
 * in one flat key namespace, so a step that was **skipped** borrowed the value
 * of whichever step's order happened to equal its action id — in practice the
 * step after it, which is what made it look like the value had shifted by one
 * row. The filter path had the same defect (KAN-1090); this is the display
 * half.
 */
export function readStepValue(
  stepData: Record<string, unknown> | null | undefined,
  step: StepKeyLike,
  chainSteps: readonly StepKeyLike[]
): unknown {
  if (!stepData) return undefined

  const own = stepData[String(step.step_order)]
  if (own !== undefined) return own

  // Ambiguous: some step in this chain sits at the order this action id would
  // name, so a value under that key belongs to that step, not to this one.
  const collides = chainSteps.some((s) => s.step_order === step.target_action_id)
  if (collides) return undefined

  return stepData[String(step.target_action_id)]
}
