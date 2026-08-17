/**
 * Communication-Gap Feed API Types
 *
 * Backend contract for GET /api/v1/clients/reports/feeds/communication-gap
 * (client-service, «Великий розрив», migrated Metabase Card 125). Mirrors
 * services/client/app/schemas/communication_gap_feed.py,
 * services/client/app/routers/reports.py and docs/communication-gap-feed.md.
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `sell_from`/`sell_to` are optional AND independent: either may be sent
 * without the other (the card's two separate `[[…]]` blocks, same shape as the
 * low-verification feed and unlike the searcher feed's both-or-neither pair).
 * They bound the client's LAST debt purchase date and can only NARROW the
 * feed, which is also why this endpoint has no 366-day window cap to mirror.
 *
 * `gap_min` is optional, `>= 0` and capped at the int32 ceiling. It keeps only
 * rows whose `communication_gap` is at least that many days (a null gap counts
 * as 0) and is applied BEFORE pagination, so `total` describes the filtered
 * feed. `0` is a legitimate value (it means "no minimum" semantically, but it
 * is a value the operator can type) and must survive every falsy check on the
 * way to the wire.
 *
 * `skip`/`limit` mirror the client-listing pagination of the same service:
 * `limit` defaults to 50 server-side and is capped at 500; `skip` is capped at
 * the int32 ceiling.
 */
export interface CommunicationGapFeedParams {
  project_id: number
  sell_from?: string // YYYY-MM-DD
  sell_to?: string // YYYY-MM-DD
  gap_min?: number
  skip?: number
  limit?: number
  /**
   * IANA timezone of the user's profile; the backend defaults to UTC when
   * omitted. It governs THREE things — the reference "today" the gap is
   * measured against, the calendar-day cut of `assignment_date` and
   * `last_promise_date`, and the 30-day payment window — and deliberately not
   * `last_interaction_date`, which stays a UTC cut (Card 125 parity).
   */
  timezone?: string
}

/**
 * One out-of-contact client, labelled with its responsible employee's org data.
 *
 * `communication_gap` is the headline number: `least(days since assignment,
 * days since the last interaction)` against the reference "today" in the
 * requested timezone — the SMALLER of the two on purpose, so a client assigned
 * three days ago is not blamed on the new owner as a year of neglect. It is
 * null only if BOTH inputs are missing (no production row shows that today,
 * but the backend's LEFT JOINs allow it).
 *
 * Nearly every field is nullable, and each null is a documented product state
 * rather than missing data:
 * - `last_promise_date` is null for 89–94 % of production rows — a client is in
 *   this feed precisely because nobody extracted a promise to pay (a row only
 *   exists while that date is in the PAST or absent);
 * - `department` is null for an employee with no role/department membership in
 *   the project: Card 125's population filter is `department in (…) OR
 *   department IS NULL`, unique to this card among the migrated ones, so such
 *   clients legitimately belong here (the sibling Card 148 feed drops them);
 * - `inn` (`clients.tax_id`) is application-enforced only;
 * - `sell_date` is null when the client's latest debt row carries no
 *   `purchase_date` (the card's `ORDER BY purchase_date DESC LIMIT 1` is NULLS
 *   FIRST, so such a row WINS) — and such a client falls out of ANY sell window;
 * - `employee_name` / `group_name` can be null when the auth-service ships a
 *   non-string label: that ONE cell degrades instead of taking the work list
 *   down (a non-string department, being a FILTER input, drops the row instead).
 *
 * Date cuts are deliberately asymmetric and must NOT be re-shifted here:
 * `sell_date` is a plain DATE column with no timezone, `assignment_date` and
 * `last_promise_date` are cut in the requested `timezone`, and
 * `last_interaction_date` keeps the card's UTC cut whatever timezone was
 * requested (its `+3 h` lands after truncation and is a genuine no-op).
 *
 * `body_amount` is structurally non-NULL (the candidate query requires a
 * non-NULL sum of principal over the client's ACTIVE debts) and is an exact
 * `Decimal`, so it serialises as a JSON STRING ("15000.00"); the union with
 * `number` covers a payload that ever ships it unquoted.
 */
export interface CommunicationGapFeedRow {
  client_id: number
  inn: string | null
  sell_date: string | null // YYYY-MM-DD
  assignment_date: string | null // YYYY-MM-DD
  last_promise_date: string | null // YYYY-MM-DD
  employee_id: number
  employee_name: string | null
  department: string | null
  group_name: string | null
  body_amount: number | string
  last_interaction_date: string | null // YYYY-MM-DD
  communication_gap: number | null
}

/**
 * Response payload. `sell_from`/`sell_to`/`gap_min` echo the filters that were
 * applied and stay null when not requested.
 *
 * `total` counts the whole filtered feed (not the returned page) and stays
 * stable across pages. `rows` come pre-sorted by the responsible employee's
 * display name, then `communication_gap` DESCENDING (worst gaps first, card
 * parity), then `client_id` as a tie-breaker — load-bearing rather than
 * decorative, since 99.4 % of production rows collide on (employee, gap). The
 * UI never re-sorts them.
 *
 * `generated_at` is stamped when the rows were COMPUTED, not when they were
 * served: the feed is cached for a minute server-side.
 *
 * An empty feed is a normal 200 (a narrow sell window or a `gap_min` above ~50
 * simply holds no rows — the production distribution is p50 = 5, p90 = 10,
 * max = 49 days, probe 2026-08-17).
 */
export interface CommunicationGapFeedResponse {
  project_id: number
  sell_from: string | null
  sell_to: string | null
  gap_min: number | null
  rows: CommunicationGapFeedRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
  generated_at: string
}
