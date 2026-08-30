/**
 * KAN-973 — whether a hotkey press may open the TA modal.
 *
 * Only one TA modal is allowed at a time anywhere in the system, matching the
 * call modal's single-instance rule (KAN-145/417). "Anywhere" is literal: a
 * session minimized on another client still counts, because the minimize
 * snapshot lives in a persisted global store and restoring it would collide
 * with a second modal.
 *
 * Pure, in the shape of ``decideChainAutoOpen`` — the alternative is asserting
 * this through a rendered Client Card, and the interesting cases (minimized on
 * a different client, unassigned key) are all decidable from three booleans.
 *
 * The guard is deliberately narrow: it governs HOTKEY launches only. Opening
 * the modal by clicking stays exactly as it is today, per the ticket.
 */

/** Why a hotkey launch was refused, when the operator should be told. */
export type HotkeyBlockReason = 'open' | 'minimized'

export interface HotkeyLaunchDecision<T> {
  /** Template to launch with, or ``null`` when nothing should open. */
  launch: T | null
  /**
   * Reason to surface in a toast, or ``null`` to stay silent.
   *
   * Silence is a requirement, not an omission: an unassigned combination must
   * do nothing at all. Operators will have bare-key bindings, so most keys they
   * press are unassigned — a toast on each would be constant noise.
   */
  blocked: HotkeyBlockReason | null
}

const SILENT = { launch: null, blocked: null } as const

/**
 * Decide what a hotkey press should do.
 *
 * ``template`` is the resolved binding (see ``resolveHotkeyTarget``); ``null``
 * means the combination is unassigned.
 *
 * Order matters. The unassigned check comes FIRST: pressing an unbound key
 * while a modal happens to be open must stay silent rather than explain why a
 * modal that was never going to open did not open.
 *
 * ``isExecutorOpen`` is checked before ``hasMinimizedSession`` only so the
 * message names the state the operator can actually see. Both refuse.
 */
export function decideHotkeyLaunch<T>(params: {
  template: T | null
  isExecutorOpen: boolean
  hasMinimizedSession: boolean
}): HotkeyLaunchDecision<T> {
  const { template, isExecutorOpen, hasMinimizedSession } = params

  if (template === null || template === undefined) return SILENT
  if (isExecutorOpen) return { launch: null, blocked: 'open' }
  if (hasMinimizedSession) return { launch: null, blocked: 'minimized' }

  return { launch: template, blocked: null }
}
