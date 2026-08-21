import { describe, it, expect } from 'vitest'
import { transformImportJobDetail } from '../transformers'

// The parameter interface is module-private in transformers.ts. Derived from
// the function rather than exported for the test's sake, so widening the
// module's public surface is not the price of covering it — and so this stays
// correct if the interface changes.
type BackendJob = Parameters<typeof transformImportJobDetail>[0]

/**
 * The counter mapping differs per import type, and a mistake here produces
 * wrong-but-plausible numbers rather than a visible failure: the same three
 * backend fields are read differently for client tags and contact tags, and
 * the two disagree about what "successful" counts.
 *
 *   tag_assignment          successful_records = applied (client, tag) pairs
 *                           updated_records    = unique successful clients
 *   contact_tag_assignment  successful_records = FILE ROWS
 *                           updated_records    = CONTACTS (one row can touch many)
 */
function backendJob(overrides: Partial<BackendJob> = {}) {
  return {
    id: 1,
    batch_id: 'CTAG-1',
    filename: 'tags.csv',
    user_id: 1,
    username: 'op',
    created_at: '2026-08-10T00:00:00Z',
    status: 'completed',
    total_records: 10,
    successful_records: 8,
    updated_records: 25,
    failed_records: 2,
    import_type: 'contact_tag_assignment',
    import_options: {},
    ...overrides,
  } as BackendJob
}

describe('transformImportJobDetail — counter mapping per import type', () => {
  // The fixture used to supply `file_name` -- the field the transformer
  // OUTPUTS -- behind a double cast, so `backend.filename` was undefined in
  // every case here and the rename was never exercised. Asserted directly so
  // the cast cannot drift back.
  it('renames the backend filename field', () => {
    expect(transformImportJobDetail(backendJob()).file_name).toBe('tags.csv')
  })

  describe('contact_tag_assignment', () => {
    it('reports rows applied, not contacts, as successful_clients', () => {
      // successful_records counts FILE ROWS here. Reading updated_records
      // instead would put a contact count beside a row-based total and make
      // applied + failed exceed total_rows.
      const d = transformImportJobDetail(backendJob())
      expect(d.successful_clients).toBe(8)
      expect(d.total_rows).toBe(10)
      expect((d.successful_clients ?? 0) + 2).toBeLessThanOrEqual(d.total_rows)
    })

    it('keeps the contact count on updated_clients', () => {
      const d = transformImportJobDetail(backendJob())
      expect(d.updated_clients).toBe(25)
    })

    it('does not zero new_clients the way client tags do', () => {
      const d = transformImportJobDetail(backendJob())
      expect(d.new_clients).toBe(8)
    })
  })

  describe('tag_assignment', () => {
    it('swaps the two fields relative to contact tags', () => {
      const d = transformImportJobDetail(backendJob({ import_type: 'tag_assignment' }))
      expect(d.new_clients).toBe(0)
      expect(d.updated_clients).toBe(8)
      expect(d.successful_clients).toBe(25)
    })

    it('reads unique_clients from the stashed validation summary', () => {
      const d = transformImportJobDetail(
        backendJob({
          import_type: 'tag_assignment',
          import_options: { summary: { unique_clients: 6 } },
        })
      )
      expect(d.unique_clients).toBe(6)
    })
  })

  describe('other import types', () => {
    it('leaves the tag-specific fields undefined', () => {
      const d = transformImportJobDetail(backendJob({ import_type: 'simple' }))
      expect(d.successful_clients).toBeUndefined()
      expect(d.unique_clients).toBeUndefined()
      expect(d.new_clients).toBe(8)
      expect(d.updated_clients).toBe(25)
    })
  })

  describe('tag mode', () => {
    it('is read for both tag import types, so the badge can tell assign from remove', () => {
      // From import_options.mode, NOT the top-level tag_mode the LIST endpoint
      // returns. The two paths read different fields for the same concept, so
      // a fixture copied from one silently yields undefined in the other.
      for (const t of ['tag_assignment', 'contact_tag_assignment'] as const) {
        const d = transformImportJobDetail(
          backendJob({ import_type: t, import_options: { mode: 'remove' } })
        )
        expect(d.tag_mode).toBe('remove')
      }
    })

    it('is undefined for a non-tag import even when the option is present', () => {
      const d = transformImportJobDetail(
        backendJob({ import_type: 'simple', import_options: { mode: 'remove' } })
      )
      expect(d.tag_mode).toBeUndefined()
    })
  })
})
