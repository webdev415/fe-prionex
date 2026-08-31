/**
 * KAN-973 — whether the executor should auto-start a hotkey's template yet.
 *
 * Extracted for the same reason as `decideChainAutoOpen`: the rule is about
 * distinguishing "not loaded yet" from "loaded and empty", and getting that
 * wrong is invisible in the happy path but wrong on a slow network — which is
 * exactly how the two same-commit races in this component (KAN-977) got
 * through review the first time.
 *
 * The caller latches on `start` so this runs at most once per modal open.
 */

export interface HotkeyAutoStartDecision<T> {
  /** Template to start now, or `null` to do nothing on this render. */
  start: T | null
}

/**
 * Decide whether to start `initialTemplateId` now.
 *
 * Returns nothing to start when:
 *
 * * there is no hotkey template — the modal was opened by a click;
 * * `instancesLoaded` is false. The instances query reports "still loading" and
 *   "none active" as the same value (`undefined` vs an empty find), so acting
 *   before it settles would start a second chain for a client who already has
 *   one — which the server rejects with a 409;
 * * the client already has an active instance. That instance is what the modal
 *   shows; the hotkey defers to it rather than competing;
 * * the template is not in `templates`. This is deliberately NOT distinguished
 *   from "templates still loading" by the caller: while loading, the effect
 *   re-runs when they arrive; once loaded, a missing id means the template is
 *   inaccessible to this operator, which the ticket says behaves as unassigned
 *   — silently, with no error.
 */
export function decideHotkeyAutoStart<T extends { id: number }>(params: {
  initialTemplateId: number | null
  instancesLoaded: boolean
  hasActiveInstance: boolean
  templates: T[]
}): HotkeyAutoStartDecision<T> {
  const { initialTemplateId, instancesLoaded, hasActiveInstance, templates } = params

  if (initialTemplateId === null) return { start: null }
  if (!instancesLoaded) return { start: null }
  if (hasActiveInstance) return { start: null }

  return { start: templates.find((t) => t.id === initialTemplateId) ?? null }
}
