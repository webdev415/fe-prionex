/**
 * Vendor-import status badge derivation.
 *
 * Single source of truth for the UI status string shown in the import
 * history list, the import detail page, and the post-import modal. All
 * three sites used to inline their own derivation; that drifted and
 * (more importantly) read only the top-level ``errors_count``, which
 * stays at 0 even when a downstream phase silently drops every row
 * (e.g. ``skipped_unresolved_debt`` on write-offs, ``failed`` on
 * payments). The helper here aggregates per-phase ``downstream_summary``
 * values so a vendor job that completed with phases-failed renders as
 * ``completed_with_errors`` instead of green.
 */

import type {
  ImportJob,
  ImportJobDetail,
  ImportJobStatus,
  VendorDownstreamSummary,
  VendorFilePhase,
} from '../types'

/** UI status string consumed by the badge components. */
export type ImportUiStatus =
  | 'done'
  | 'failed'
  | 'completed_with_errors'
  | 'in_progress'
  | 'pending'
  | 'cancelled'

/** Map raw backend status onto the UI vocabulary. */
function baseUiStatus(status: ImportJobStatus): ImportUiStatus {
  if (status === 'completed') return 'done'
  if (status === 'failed') return 'failed'
  if (status === 'in_progress') return 'in_progress'
  if (status === 'pending') return 'pending'
  if (status === 'cancelled') return 'cancelled'
  return 'done'
}

/**
 * Downstream-summary keys whose nonzero value means rows were silently
 * dropped because of broken/inconsistent data (FK miss, unresolved
 * debt). These are the signals the badge must escalate on.
 *
 * NOT included: ``debts_skipped_duplicate``, ``clients_existing``,
 * ``client_projects_existing`` — those are benign de-duplication signals
 * (re-running the same import) and should never push a job into
 * "completed_with_errors", which would be alarmist.
 */
const BROKEN_DATA_SUMMARY_KEYS = ['skipped_unresolved_debt', 'failed'] as const

/** Coerce ``unknown`` to a number; return 0 on anything that isn't one. */
function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/**
 * True when this phase shows a "broken data" signal — either
 * VendorFileResult-level ``failed_rows > 0`` (parser/FK rejections) OR
 * a downstream-service summary key indicating silent drops.
 */
function phaseHasBrokenData(phase: VendorFilePhase): boolean {
  if (phase.status === 'failed') return true
  if ((phase.failed_rows ?? 0) > 0) return true
  const summary = phase.downstream_summary as VendorDownstreamSummary | null | undefined
  if (!summary) return false
  for (const key of BROKEN_DATA_SUMMARY_KEYS) {
    if (asNumber(summary[key]) > 0) return true
  }
  return false
}

interface VendorAware {
  status: ImportJobStatus
  errors_count: number
  vendor_phases?: VendorFilePhase[]
  import_type?: string
}

/**
 * Compute the UI badge status for a vendor or simple import job.
 *
 * Rules (in order):
 *   1. If status is not ``completed``, return the corresponding UI
 *      string (``failed``, ``in_progress``, etc.) untouched. Per-phase
 *      data on in-progress jobs is partial and not safe to aggregate.
 *   2. ``completed`` + top-level ``errors_count > 0`` →
 *      ``completed_with_errors`` (preserves pre-rollout behavior on
 *      simple imports and on vendor jobs whose backend hasn't been
 *      upgraded yet).
 *   3. ``completed`` + any ``vendor_phase`` with broken-data signal →
 *      ``completed_with_errors`` (the new rule).
 *   4. Otherwise ``done``.
 *
 * Pre-rollout vendor jobs (no ``vendor_phases`` or all summaries empty)
 * fall through to rule 4 and behave exactly as they did before, so
 * deploying the FE before every backend job has phase_results doesn't
 * regress anything.
 */
export function computeImportUiStatus(job: VendorAware): ImportUiStatus {
  if (job.status !== 'completed') {
    return baseUiStatus(job.status)
  }
  if (job.errors_count > 0) return 'completed_with_errors'
  const phases = job.vendor_phases
  if (phases && phases.length > 0) {
    if (phases.some(phaseHasBrokenData)) return 'completed_with_errors'
  }
  return 'done'
}

/** Convenience overload for ImportJob (list shape). */
export function computeImportUiStatusFromJob(job: ImportJob): ImportUiStatus {
  return computeImportUiStatus({
    status: job.status,
    errors_count: job.errors_count,
    vendor_phases: job.vendor_phases,
    import_type: job.import_type,
  })
}

/** Convenience overload for ImportJobDetail (detail shape). */
export function computeImportUiStatusFromDetail(detail: ImportJobDetail): ImportUiStatus {
  return computeImportUiStatus({
    status: detail.status,
    errors_count: detail.errors_count,
    vendor_phases: detail.vendor_phases,
    import_type: detail.import_type,
  })
}
