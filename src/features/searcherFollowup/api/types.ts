/**
 * Searcher Follow-up Feed API Types
 *
 * Backend contract for GET /api/v1/clients/reports/feeds/searcher-followup
 * (client-service, «Відпрацювання серчера», migrated Metabase Card 123).
 * Mirrors services/client/app/schemas/searcher_followup_feed.py and
 * docs/searcher-followup-feed.md.
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `date_start`/`date_end` bound the calendar day (cut in `timezone`) of the
 * SEARCHER interaction and must be given together or not at all — the card's
 * date filter is a single Metabase `[[…]]` block, unlike the low-verification
 * feed's two independent bounds; half a window answers 400. Omitting both
 * returns the whole history (~560 rows on the production probe of
 * 2026-08-13, see docs/searcher-followup-feed.md in api-prionex). The tab
 * always sends both — its default window is today–today in the profile
 * timezone (Techno-Finance parity) — so the omission branch exists here only
 * because the API supports it.
 *
 * No 366-day window cap applies (unlike the two per-employee reports): the
 * window filters the output of a per-client lateral probed once per client
 * whatever the dates say, so there is no client-side cap to mirror either.
 *
 * `skip`/`limit` mirror the client-listing pagination of the same service:
 * `limit` defaults to 50 server-side and is capped at 500.
 */
export interface SearcherFollowupFeedParams {
  project_id: number
  date_start?: string // YYYY-MM-DD
  date_end?: string // YYYY-MM-DD
  skip?: number
  limit?: number
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
}

/**
 * One client the searcher found data for and nobody has worked since.
 *
 * `interaction_at` and `last_call_at` are absolute UTC instants (ISO
 * datetimes with `Z`) — the card baked a `+3h` display shift into the VALUE,
 * the API deliberately does not; the UI formats them in the profile timezone.
 *
 * Every enrichment field is nullable because the card LEFT JOINs all of them
 * and keeps the row regardless: an unassigned client (`employee_id` null) or
 * one whose employee has no org context in the project still needs working —
 * hiding it would hide exactly the clients nobody owns. `searcher_id`/`_name`
 * are null for rows written by an automated chain rather than a person.
 *
 * `last_call_at`/`last_call_outcome` semantics (probe-driven, the card
 * conflates all three states):
 * - BOTH null — no call at all (never called, or the responsible employee has
 *   no telephony seat — ~27 % of production rows, probe 2026-08-13);
 * - `last_call_at` set, `last_call_outcome` null — a call happened but the
 *   agent never recorded an outcome;
 * - both set — a call with a known result.
 */
export interface SearcherFollowupRow {
  client_id: number
  inn: string | null
  interaction_at: string // UTC ISO datetime
  searcher_id: number | null
  searcher_name: string | null
  employee_id: number | null
  employee_name: string | null
  department: string | null
  group_name: string | null
  last_call_at: string | null // UTC ISO datetime
  /**
   * Raw telephony value as the wire carries it — a free VARCHAR(50) the
   * backend deliberately does NOT enum-validate, so that a new outcome never
   * turns the work list into a 500. Localisation (and openness to values this
   * build has no label for) lives in the shared `classifyCallOutcome`
   * (src/lib/callOutcome.ts) via src/lib/feedCallOutcome.ts.
   */
  last_call_outcome: string | null
}

/**
 * Response payload. `date_start`/`date_end` echo the applied window and stay
 * null when the whole history was requested.
 *
 * `rows` come pre-sorted by `department`, `group_name`, the responsible
 * employee's LAST name, then `client_id` (nulls after values) — the sort is
 * fixed SERVER-side and the UI never re-sorts. `total` counts the whole feed,
 * not the page, and stays stable across pages. An empty feed is a normal 200
 * (a weekend window can simply hold no searcher finds).
 */
export interface SearcherFollowupResponse {
  project_id: number
  date_start: string | null
  date_end: string | null
  rows: SearcherFollowupRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
  generated_at: string
}
