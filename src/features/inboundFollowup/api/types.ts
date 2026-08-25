/**
 * Inbound Follow-up Feed API Types
 *
 * Backend contract for GET /api/v1/clients/reports/feeds/inbound-followup
 * (client-service, «Вхід без відпрацювання», migrated Metabase Card 122).
 * Mirrors services/client/app/schemas/inbound_followup_feed.py and
 * docs/inbound-followup-feed.md.
 *
 * The closest sibling is the Card 123 feed («Серчер без відпрацювання»): the
 * source system shares ONE nine-column contact shape between the two, so these
 * types deliberately mirror `searcherFollowup/api/types.ts` field for field —
 * `interaction_type` (why the client got in touch) replaces that feed's
 * `searcher_id`/`searcher_name` pair.
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `date_start`/`date_end` bound the calendar day (cut in `timezone`) of the
 * client's LATEST interaction and must be given together or not at all — the
 * card's date filter is a single Metabase `[[…]]` block; half a window answers
 * 400. Omitting both returns the whole history (210 rows on the production
 * probe of 2026-08-25, see docs/inbound-followup-feed.md in api-prionex): there
 * is deliberately NO backend default window, because "today" is the source
 * system's FRONTEND default and stays here. The tab always sends both bounds.
 *
 * No window cap applies (unlike the two per-employee reports): the window can
 * only narrow an already tiny feed, so there is no client-side cap to mirror
 * either. What IS bounded is the candidate population — past
 * `INBOUND_FOLLOWUP_FEED_MAX_CANDIDATES` the request is refused with a 400
 * whose detail asks for a narrower window, and the tab shows that detail.
 *
 * `skip`/`limit` mirror the client-listing pagination of the same service:
 * `limit` defaults to 50 server-side and is capped at 500.
 */
export interface InboundFollowupFeedParams {
  project_id: number
  date_start?: string // YYYY-MM-DD
  date_end?: string // YYYY-MM-DD
  skip?: number
  limit?: number
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
}

/**
 * One client whose inbound request is still waiting to be worked: their latest
 * interaction (outside the searcher chain) is a tech-support step parked on
 * «Очікує на зворотній зв'язок», and nobody has recorded anything since.
 *
 * `interaction_at` and `last_call_at` are absolute UTC instants (ISO datetimes
 * with `Z`) — the card baked a `+3h` display shift into the VALUE, the API
 * deliberately does not; the UI formats them in the profile timezone.
 *
 * Every enrichment field is nullable because the card LEFT JOINs all of them
 * and keeps the row regardless: an unassigned client (`employee_id` null) or
 * one whose employee has no org context in the project still needs working —
 * and those are the clients nobody owns, so hiding them would hide the point of
 * the feed. On production 79 % of rows show no department (roles carrying no
 * `department_id`, memberships carrying no `group_id` — probe 2026-08-25).
 *
 * `last_call_at`/`last_call_outcome` semantics (probe-driven, the card
 * conflates all three states):
 * - BOTH null — no call at all. Here this is the COMMON case, not an anomaly:
 *   89 % of rows have a responsible employee with NO `asterisk_extension` at
 *   all and 94 % have no call (probe 2026-08-25), so two blank telephony
 *   columns are correct output rather than a defect — and `null` cannot tell
 *   "never called" from "no telephony seat" (neither can the card);
 * - `last_call_at` set, `last_call_outcome` null — a call happened but the
 *   agent never recorded an outcome;
 * - both set — a call with a known result.
 */
export interface InboundFollowupRow {
  client_id: number
  inn: string | null
  interaction_at: string // UTC ISO datetime
  /**
   * The step's «Причина звернення» value — why the client got in touch. A free
   * dropdown label, hence a plain string, and null when the interaction's
   * `step_data` carries no type entry at all.
   */
  interaction_type: string | null
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
 * not the page, and stays stable across pages. An empty feed is a normal 200:
 * the population is 1-8 rows a day, so a windowed day with none is routine.
 *
 * `generated_at` is NOT a freshness stamp here and must not be rendered as one.
 * Unlike its three sibling feeds this endpoint has no result cache (the feed is
 * a single page at the default limit), so the field is always "just now" — it
 * exists purely for shape parity with the feeds that do cache.
 */
export interface InboundFollowupResponse {
  project_id: number
  date_start: string | null
  date_end: string | null
  rows: InboundFollowupRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
  generated_at: string
}
