/**
 * Unit tests for the vendor-import status helper.
 *
 * The helper aggregates per-phase signals so a "completed" vendor job
 * whose downstream phase silently dropped every row renders as
 * "completed_with_errors" instead of green. Pre-rollout jobs (no
 * vendor_phases / no downstream_summary) must keep behaving the way
 * they did before.
 */

import { describe, it, expect } from 'vitest'

import { computeImportUiStatus } from '../statusHelpers'
import type { ImportJobStatus, VendorFilePhase } from '../../types'

function makePhase(overrides: Partial<VendorFilePhase> = {}): VendorFilePhase {
  return {
    logical_name: 'users',
    display_name: 'Users',
    filename: 'users.csv',
    target_db: 'client-DB clients',
    status: 'completed',
    ...overrides,
  }
}

function makeJob(
  status: ImportJobStatus,
  errorsCount = 0,
  phases?: VendorFilePhase[],
  importType: string = 'vendor'
) {
  return {
    status,
    errors_count: errorsCount,
    vendor_phases: phases,
    import_type: importType,
  }
}

describe('computeImportUiStatus', () => {
  describe('non-terminal statuses', () => {
    it('returns in_progress unchanged regardless of phase data', () => {
      // In-progress phase data is partial; aggregating it would generate
      // noisy "completed_with_errors" badges before the job actually ends.
      expect(
        computeImportUiStatus(
          makeJob('in_progress', 0, [
            makePhase({ failed_rows: 99 }), // would normally escalate
          ])
        )
      ).toBe('in_progress')
    })

    it('returns failed unchanged', () => {
      expect(computeImportUiStatus(makeJob('failed', 5))).toBe('failed')
    })

    it('returns pending unchanged', () => {
      expect(computeImportUiStatus(makeJob('pending'))).toBe('pending')
    })

    it('returns cancelled unchanged', () => {
      expect(computeImportUiStatus(makeJob('cancelled'))).toBe('cancelled')
    })
  })

  describe('completed + top-level errors', () => {
    it('escalates when errors_count > 0 even with no phase data', () => {
      // Preserves behavior for simple imports and for vendor jobs whose
      // backend predates the phase_results rollout.
      expect(computeImportUiStatus(makeJob('completed', 7))).toBe('completed_with_errors')
    })
  })

  describe('completed + clean phases (the green path)', () => {
    it('returns done when no errors and no phase data', () => {
      expect(computeImportUiStatus(makeJob('completed'))).toBe('done')
    })

    it('returns done when phases all clean', () => {
      expect(
        computeImportUiStatus(
          makeJob('completed', 0, [
            makePhase({
              logical_name: 'users',
              status: 'completed',
              failed_rows: 0,
              downstream_summary: { clients_created: 10, debts_created: 10 },
            }),
            makePhase({
              logical_name: 'credits',
              status: 'completed',
              failed_rows: 0,
            }),
          ])
        )
      ).toBe('done')
    })

    it('treats benign duplicate-skips as not-an-error', () => {
      // Re-running an import → debts_skipped_duplicate > 0 is expected
      // (idempotency); must not push the badge into completed_with_errors.
      expect(
        computeImportUiStatus(
          makeJob('completed', 0, [
            makePhase({
              logical_name: 'users',
              status: 'completed',
              failed_rows: 0,
              downstream_summary: {
                clients_created: 0,
                clients_existing: 100,
                debts_created: 0,
                debts_skipped_duplicate: 100,
              },
            }),
          ])
        )
      ).toBe('done')
    })
  })

  describe('completed + silent-drop signals', () => {
    it('escalates when a phase reports skipped_unresolved_debt > 0', () => {
      // The exact bug class: write-offs all silently dropped because no
      // matching debt could be found, but top-level errors_count is 0.
      expect(
        computeImportUiStatus(
          makeJob('completed', 0, [
            makePhase({
              logical_name: 'write_offs',
              status: 'completed',
              failed_rows: 0,
              downstream_summary: {
                created: 0,
                skipped_unresolved_debt: 50,
              },
            }),
          ])
        )
      ).toBe('completed_with_errors')
    })

    it('escalates when a phase reports payment failed > 0', () => {
      expect(
        computeImportUiStatus(
          makeJob('completed', 0, [
            makePhase({
              logical_name: 'payments',
              status: 'completed',
              failed_rows: 0,
              downstream_summary: {
                processed: 100,
                success: 90,
                failed: 10,
              },
            }),
          ])
        )
      ).toBe('completed_with_errors')
    })

    it('escalates when phase status itself is failed', () => {
      expect(
        computeImportUiStatus(
          makeJob('completed', 0, [makePhase({ logical_name: 'credits', status: 'failed' })])
        )
      ).toBe('completed_with_errors')
    })

    it('escalates when failed_rows > 0 even without downstream_summary', () => {
      // VendorFileResult-level parser/FK failures, e.g. fk_unresolved
      // produced inside _enforce_fks.
      expect(
        computeImportUiStatus(
          makeJob('completed', 0, [
            makePhase({
              logical_name: 'payments',
              status: 'completed',
              failed_rows: 3,
            }),
          ])
        )
      ).toBe('completed_with_errors')
    })

    it('respects mixed phases: one bad phase escalates the whole job', () => {
      expect(
        computeImportUiStatus(
          makeJob('completed', 0, [
            makePhase({ logical_name: 'users', status: 'completed', failed_rows: 0 }),
            makePhase({
              logical_name: 'write_offs',
              status: 'completed',
              downstream_summary: { skipped_unresolved_debt: 1 },
            }),
            makePhase({ logical_name: 'payments', status: 'completed', failed_rows: 0 }),
          ])
        )
      ).toBe('completed_with_errors')
    })
  })

  describe('backwards compatibility', () => {
    it('falls back to errors_count for jobs without vendor_phases', () => {
      // Pre-PR1 vendor job: backend never wrote phase_results, so the FE
      // sees no vendor_phases. Must not crash and must use the old rule.
      expect(computeImportUiStatus(makeJob('completed', 0))).toBe('done')
      expect(computeImportUiStatus(makeJob('completed', 5))).toBe('completed_with_errors')
    })

    it('handles empty vendor_phases array as no-data', () => {
      expect(computeImportUiStatus(makeJob('completed', 0, []))).toBe('done')
    })

    it('ignores phases with neither failed_rows nor downstream_summary', () => {
      expect(
        computeImportUiStatus(
          makeJob('completed', 0, [
            makePhase({ logical_name: 'users', status: 'completed' }),
            makePhase({ logical_name: 'credits', status: 'completed' }),
          ])
        )
      ).toBe('done')
    })
  })
})
