/**
 * KAN-977 — single-candidate auto-select for the TA modal's contact step.
 *
 * When a contact step has exactly one candidate there is nothing to choose, so
 * the operator's click is pure ceremony. This decides when to make it for them.
 *
 * Pure on purpose: ChainExecutor renders the contact step in two places (the
 * wizard and the all-at-once card), each owning its own contact query, so the
 * rule would otherwise be written twice and drift. Extracting it also makes it
 * testable — the component needs a dozen mocked hooks to render at all.
 */

/** Minimal shape of a contact row; both call sites pass richer objects. */
export interface ContactCandidate {
  contact_value: string
}

export interface AutoSelectArgs {
  /** ``field_type`` of the step's Target Action. Only ``contact`` qualifies. */
  fieldType: string | null | undefined
  /** ``contact_medium === 'email'``. Email steps are out of scope — see below. */
  isEmailStep: boolean
  /** Candidates for this step. ``undefined`` while the query is in flight. */
  candidates: ContactCandidate[] | undefined
  /** What the step holds now — a template preset, a prefill, or operator input. */
  currentValue: string
  /** Whether this step was already auto-selected once. */
  alreadyAutoSelected: boolean
}

/**
 * The contact value to select, or ``null`` to leave the step alone.
 *
 * Returns ``null`` — deliberately — when:
 *
 * * the step is not a contact step, or is an email step. The ticket says phone
 *   throughout, and the same code path serves email contact steps; auto-selecting
 *   a lone email address is a separate decision nobody has made.
 * * the candidate list has not arrived yet (``undefined``). It is fetched, so on
 *   the render where the step becomes current it is always empty — checking once
 *   and giving up would mean never selecting anything.
 * * there is not exactly one candidate. Zero keeps the existing error state;
 *   two or more is the operator's choice, and pre-selecting one of several is
 *   the hotkey-only heuristic in KAN-973, explicitly out of scope here.
 * * the step already holds a value. A template preset and the
 *   opened-from-a-phone-row prefill both outrank this.
 * * it already fired for this step. The radio list lets the operator untick the
 *   checked entry; without this the auto-select would immediately re-tick it and
 *   the entry could never be cleared.
 */
export function pickSingleContactCandidate(args: AutoSelectArgs): string | null {
  const { fieldType, isEmailStep, candidates, currentValue, alreadyAutoSelected } = args

  if (fieldType !== 'contact') return null
  if (isEmailStep) return null
  if (alreadyAutoSelected) return null
  if (currentValue) return null
  if (!candidates || candidates.length !== 1) return null

  const only = candidates[0]?.contact_value
  return only ? only : null
}
