/**
 * Helpers for assembling the final TA-interaction payload from the
 * authoritative server snapshot (chain_instances.step_data).
 *
 * Why this exists: each chain step is snapshotted to the backend as it's
 * advanced, so chain_instances.step_data is always a COMPLETE record of the
 * steps entered so far. The ChainExecutor's in-memory refs, by contrast, are
 * lost when the form is unmounted during a minimize/restore cycle. Building
 * the final save from the snapshot (with in-memory values layered on top)
 * means a minimize/restore can never drop previously-entered fields from the
 * saved interaction — and therefore from the TA history.
 */

import type { ChainInstanceStepSnapshot } from '@/features/taInteractions/api/types'

/**
 * A local, not-yet-persisted edit to a previously confirmed step. Keyed by
 * step_order in the executor. Any undefined field leaves the server snapshot's
 * value untouched; an empty string explicitly clears that field.
 */
export interface StepEdit {
  value?: string
  promiseDate?: string
  promiseAmount?: string
  creditId?: string
}

/**
 * Layer local per-step edits over the authoritative server snapshot, returning
 * a NEW snapshot (inputs untouched). This is what makes editing a previously
 * confirmed step persist: the edited step's fields override the server copy,
 * per step, without disturbing any OTHER step's values (so a single interaction
 * promise assembled from multiple steps is never clobbered).
 */
export function applyStepEdits(
  snapshot: Record<string, ChainInstanceStepSnapshot> | null | undefined,
  edits: Record<string, StepEdit> | null | undefined
): Record<string, ChainInstanceStepSnapshot> {
  const out: Record<string, ChainInstanceStepSnapshot> = { ...(snapshot ?? {}) }
  if (edits) {
    for (const [order, e] of Object.entries(edits)) {
      const base = out[order] ?? ({} as ChainInstanceStepSnapshot)
      out[order] = {
        ...base,
        ...(e.value !== undefined ? { value: e.value } : {}),
        ...(e.promiseDate !== undefined ? { promise_date: e.promiseDate } : {}),
        ...(e.promiseAmount !== undefined ? { promise_amount: e.promiseAmount } : {}),
        ...(e.creditId !== undefined ? { credit_id: e.creditId } : {}),
      }
    }
  }
  return out
}

export interface SnapshotCollected {
  /** step_order → entered value string. */
  stepData: Record<string, string>
  /** step_order → chosen dropdown value id. */
  dropdownIds: Record<string, number>
  promiseDate: string
  promiseAmount: string
  creditId: string
}

/**
 * Reconstruct the per-step collected values from a chain instance's server
 * snapshot. Empty/missing fields are skipped; promise/amount/credit take the
 * first non-empty occurrence (matching the executor's accumulation order).
 */
export function collectFromSnapshot(
  snapshot: Record<string, ChainInstanceStepSnapshot> | null | undefined
): SnapshotCollected {
  const stepData: Record<string, string> = {}
  const dropdownIds: Record<string, number> = {}
  let promiseDate = ''
  let promiseAmount = ''
  let creditId = ''

  if (snapshot) {
    for (const [order, snap] of Object.entries(snapshot)) {
      if (snap?.value != null && snap.value !== '') stepData[order] = snap.value
      if (snap?.dropdown_value_id != null) dropdownIds[order] = snap.dropdown_value_id
      if (snap?.promise_date && !promiseDate) promiseDate = snap.promise_date
      if (snap?.promise_amount && !promiseAmount) promiseAmount = snap.promise_amount
      if (snap?.credit_id && !creditId) creditId = snap.credit_id
    }
  }

  return { stepData, dropdownIds, promiseDate, promiseAmount, creditId }
}
