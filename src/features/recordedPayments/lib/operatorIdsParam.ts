/**
 * The `rpu` URL parameter — the operator filter (key B, `user_ids` on the
 * wire) as it travels in a shared link: a comma-separated list of ids.
 *
 * One key holding a list rather than a repeated key: the page-wide URL shell
 * (`useUrlPagedFeedFilters.setUrlParams`) composes updates as `Record<string,
 * string | null>`, one VALUE per key, so a repeated `rpu` could neither be
 * written through it nor cleared in one update with the page reset.
 *
 * READING IS STRICT, AND A BAD VALUE IS A VERDICT, NOT A SILENT DROP. The
 * backend refuses more than 200 ids (`USER_IDS_TOO_MANY`) and an id outside
 * `1..2147483647` (`USER_IDS_OUT_OF_RANGE`); a value that is not an integer at
 * all is a 422. All three are mirrored here so an impossible filter is
 * refused in the field with a sentence, instead of coming back from the
 * server — and so that no request goes out carrying it (a request that would
 * be refused is still a request). Silently dropping the bad ids would send a
 * DIFFERENT filter from the one the link says, which is the drains tab's
 * "plausible wrong report" failure in another costume.
 */

/** The backend's `user_ids` ceiling — `USER_IDS_TOO_MANY`, `params.max_ids`. */
export const MAX_OPERATOR_IDS = 200

/** The backend's id range — `USER_IDS_OUT_OF_RANGE`, `params.min`/`params.max` (int32). */
export const MAX_OPERATOR_ID = 2_147_483_647

export type OperatorIdsReading =
  /** Absent, or every id usable: the (de-duplicated) list, possibly empty. */
  | { ids: number[]; error: null }
  /** More than the ceiling (after de-duplication) — the ids are still returned so the UI can show them. */
  | { ids: number[]; error: 'tooMany' }
  /** A token that is not an id in range — nothing is usable. */
  | { ids: number[]; error: 'invalid' }

/**
 * Parse the raw `rpu` value. `null`/empty = no filter (the absence of the key
 * is the backend default). De-duplicates while keeping the first occurrence's
 * order, the way the backend echoes a sorted, de-duplicated list.
 */
export function readOperatorIdsParam(raw: string | null): OperatorIdsReading {
  if (raw === null || raw.trim() === '') return { ids: [], error: null }
  const ids: number[] = []
  for (const token of raw.split(',')) {
    const trimmed = token.trim()
    // Digits only: `+1`, `1.0` and `1e3` are all numbers to `Number()` and none
    // of them is an id the backend would read.
    if (!/^\d+$/.test(trimmed)) return { ids: [], error: 'invalid' }
    const id = Number(trimmed)
    if (id < 1 || id > MAX_OPERATOR_ID) return { ids: [], error: 'invalid' }
    if (!ids.includes(id)) ids.push(id)
  }
  return ids.length > MAX_OPERATOR_IDS ? { ids, error: 'tooMany' } : { ids, error: null }
}

/** Format a selection for the URL; an empty selection is the ABSENCE of the key. */
export function formatOperatorIdsParam(ids: number[]): string | null {
  return ids.length === 0 ? null : ids.join(',')
}
