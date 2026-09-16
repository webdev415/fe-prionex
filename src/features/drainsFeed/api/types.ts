/**
 * Drains Feed API Types
 *
 * Backend contract for GET /api/v1/clients/reports/feeds/drains (client
 * service, «Зливи», migrated Metabase Card 120): the BROKEN-PROMISE list — the
 * client promised to pay by a day inside the window and did not.
 *
 * ONE ROW IS ONE CLIENT, and that is the sentence that separates this feed
 * from its two siblings. Cards 119 (promises) and 121 (callbacks) emit one row
 * per INTERACTION and reproduce duplicates on purpose; here the backend
 * resolves each client's LAST «Домовленість» promise over the whole history
 * and shows the client at most once. Two consequences reach the UI directly:
 * `total` counts CLIENTS, and historical windows SHRINK — a client who
 * promises again leaves the window their previous promise sat in, so a
 * bookmarked past window holds fewer rows every day (−13 % over five days,
 * measured on production).
 *
 * MONEY IS THE ROW GATE, not just a column: a client is in this feed only
 * while `promise_amount > payment_amount`. That is why a payment-service
 * outage answers 503 instead of degrading — serving without payments would
 * publish every candidate as an unpaid drain.
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `date_from`/`date_to` bound the PROMISED payment day (cut in `timezone`) and
 * are inclusive — not the day of the conversation, which is routinely a month
 * earlier. They are BOTH-OR-NEITHER, and the "neither" branch is what makes
 * this contract different from every sibling's: omitting both returns THE
 * WHOLE HISTORY (~11.3k rows out of ~15.6k candidate clients), a supported
 * mode rather than a fallback. There is no "today" default on the server side,
 * deliberately: the tab's own default window is the PREVIOUS WORKING DAY (see
 * `../lib/previousWorkingDayWindow`), which is a frontend decision the API
 * refuses to make for every caller. Sending exactly one bound answers 400, and
 * so does a difference over 366 days (an inclusive window of 367), an inverted
 * pair, a bound outside [1900-01-01 .. 9998-12-31], an unknown IANA zone, or a
 * candidate population over the endpoint's ceiling.
 *
 * `hide_worked_today` / `hide_worked` / `hide_paid` are SERVER-side filters
 * (backend default false): the feed paginates, so hiding client-side would
 * tear holes in pages, and all three change `total`. They are NOT three
 * spellings of one idea — each reads a DIFFERENT column:
 *  - `hide_worked_today` drops rows with a non-empty `last_result` («somebody
 *    has already touched this client today»);
 *  - `hide_worked` compares DATES: the row is hidden once a ЦД has reached the
 *    promised day (`promise_date`'s day `<=` `last_interaction_date`, same day
 *    counted as worked). ⚠️ It does NOT read `last_result` — the PROMISES
 *    feed's toggle of the same name does, and borrowing that predicate here
 *    yields a report in which almost nothing is "worked". The right predicate
 *    hides ~90 % of a day's rows by design;
 *  - `hide_paid` drops rows whose `payment_amount` is non-zero. After the
 *    feed's own `promise_amount > payment_amount` gate those can only be
 *    PARTIAL payers, which is what keeps it from being a no-op. "Non-zero"
 *    is literally `!= 0`: payments may be NEGATIVE (reversals), so a client
 *    whose only movement is a reversal is hidden although they paid nothing.
 * All three SHOW a row whose date or flag is missing (fail-safe to the display
 * side); that says nothing about a missing PROMISED day, which is refused in
 * SQL and is not in the feed at all, in either mode.
 *
 * `skip`/`limit` mirror the sibling feeds' pagination: `limit` defaults to 50
 * server-side and is capped at 500, `skip` at the int32 ceiling.
 */
export interface DrainsFeedParams {
  project_id: number
  /** YYYY-MM-DD, inclusive. Both bounds or NEITHER — neither = the whole history. */
  date_from?: string
  /** YYYY-MM-DD, inclusive. Both bounds or NEITHER — neither = the whole history. */
  date_to?: string
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
  /** Hide clients already touched today (non-empty `last_result`); backend default false. */
  hide_worked_today?: boolean
  /** Hide rows whose promised day a ЦД has already reached (by DATE); backend default false. */
  hide_worked?: boolean
  /** Hide rows with a non-zero `payment_amount` (partial payers); backend default false. */
  hide_paid?: boolean
  skip?: number
  limit?: number
}

/**
 * One drain row — the card's 13 output columns plus `client_id`.
 *
 * `interaction_date` and `promise_date` are absolute UTC instants (ISO
 * datetimes): the card baked a `+3h` display shift into the VALUE and
 * truncated it to a day, the API deliberately does not, and the UI formats
 * them in the profile timezone. That is not cosmetic on THIS card — 11.98 % of
 * promises change their calendar DAY under the shift (against 0.09 % on Card
 * 121). `interaction_date` is when the promise was MADE; `promise_date` is the
 * day it was made FOR and is the window's axis, and the two are routinely a
 * month apart.
 *
 * `promise_amount` and `payment_amount` are exact `Decimal` server-side and
 * therefore serialise as JSON STRINGS ("1500.00"); the union with `number`
 * covers a payload that ever ships them unquoted (the promises feed's
 * precedent). Never do arithmetic on them here — the row gate that compares
 * them lives on the server. Neither is ever null: the gate drops a NULL
 * promise before it can be rendered. `payment_amount` sums
 * the client's non-cancelled payments over `[promised day − 3 days .. today]`,
 * a PENDING payment included, and can be NEGATIVE when the window holds a
 * reversal.
 *
 * `last_interaction_date` is a bare CALENDAR DAY (YYYY-MM-DD) in the request's
 * timezone — the day of the client's last ЦД on a working department's chain,
 * whenever it happened. It is the column `hide_worked` compares against.
 *
 * `last_result` is the «Відпрацювання сьогодні» flag as text and is always a
 * STRING (the backend coalesces, never null): an EMPTY value means nobody has
 * touched the client today, which is a state, not a missing value. ⚠️ It can
 * legitimately DISAGREE with `last_interaction_date` in the first hours of a
 * local day — the date converts the zone honestly while the flag reproduces
 * the card's floor against the column's UTC clock — so a ЦД between 00:00 and
 * 03:00 Kyiv time yields today's date together with an empty flag. That is the
 * price of reproducing the card, not a defect.
 *
 * `department` / `group_name` are the org labels of the client's RESPONSIBLE
 * employee (not the recorder — Card 120 has no recorder redirection), with
 * four technical "shelf" accounts relabelled server-side. Both are nullable
 * and the nulls are a REAL population, not missing data: 9.3 % of rows have no
 * department and 17.6 % no group on the production horizon, and the source
 * system's own client-side department filter is what silently drops them.
 *
 * `link` is the backend's ready-made ABSOLUTE client-card URL. The UI does NOT
 * render it — the table builds the internal `/dashboard/clients/:id` route
 * from `client_id` instead — the field simply stays typed because the payload
 * ships it.
 */
export interface DrainsFeedRow {
  client_id: number
  inn: string | null
  interaction_date: string // UTC ISO datetime — when the promise was MADE
  interaction_type: string | null
  promise_date: string // UTC ISO datetime — the day it was made FOR (window axis)
  promise_amount: string | number
  employee_interacted: string | null
  employee_responsible: string | null
  link: string
  payment_amount: string | number
  last_interaction_date: string | null // YYYY-MM-DD calendar day
  last_result: string
  department: string | null
  group_name: string | null
}

/**
 * Response payload — the sibling feeds' envelope, with one contract difference
 * that the UI has to carry: `date_from` and `date_to` are NULLABLE. They echo
 * the window that was applied, and BOTH are null in the all-history mode.
 *
 * `rows` arrive pre-sorted SERVER-side (department, group, the responsible
 * employee's last name, then `client_id` as the final tie-breaker; rows with a
 * missing label sort after those that have one) and the UI never re-sorts:
 * sorting one page of a server-paginated feed would reorder 50 rows out of the
 * whole feed and read as a lie. `total` counts the whole FILTERED feed and,
 * uniquely in this family, counts CLIENTS.
 *
 * `generated_at` is stamped when the rows were computed — this feed has no
 * cache and no snapshot, so it is always "just now".
 */
export interface DrainsFeedResponse {
  project_id: number
  /** Null in the all-history mode — the endpoint's own nullable echo. */
  date_from: string | null
  /** Null in the all-history mode — the endpoint's own nullable echo. */
  date_to: string | null
  hide_worked_today: boolean
  hide_worked: boolean
  hide_paid: boolean
  rows: DrainsFeedRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
  generated_at: string
}
