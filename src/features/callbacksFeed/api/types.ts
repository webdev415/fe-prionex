/**
 * Callbacks Feed API Types
 *
 * Backend contract for GET /api/v1/clients/reports/feeds/callbacks
 * (client-service, «Перезвони», migrated Metabase Card 121): the CALL PLAN —
 * one row per interaction that ended in a «Передзвонити» / «Передасть
 * інформацію» outcome and whose SCHEDULED callback time falls inside the
 * window, with the two Techno-Finance toggles (hide called today / hide
 * worked).
 *
 * The family resemblance to the promises feed (Card 119) is deliberate and
 * stops at the money: this feed has NO amount columns at all — it answers
 * «whom do I ring, and when», not «who owes how much».
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `date_from`/`date_to` bound the SCHEDULED-callback calendar day (cut in
 * `timezone`) and are inclusive; the backend defaults them to "today" in
 * `timezone` when omitted, caps the difference at 366 days (an inclusive
 * window of 367) and answers 400 on an inverted pair. The tab always sends
 * both — its default window is today–today in the profile timezone
 * (Techno-Finance parity: the card's default is today in Kyiv) — so the
 * omission branch exists here only because the API supports it.
 *
 * `hide_called_today`/`hide_worked` are SERVER-side filters (backend default
 * false): the feed is paginated, so hiding client-side would tear holes in
 * pages. They are NOT two spellings of one idea — on the default window they
 * nearly coincide, but on a PAST window they diverge radically (a probe over
 * one past day: 2.7 % vs 74 % of the rows dropped):
 *  - `hide_called_today` drops rows whose last interaction already falls on
 *    today or later;
 *  - `hide_worked` compares DATES — the callback is hidden once the client's
 *    last interaction reaches its scheduled day (`promise_date::date <=
 *    last_interaction_date`), same-day included. Unlike the promises feed's
 *    toggle of the same name it does NOT look at `last_result`.
 * Both are fail-safe towards SHOWING a row when a date is missing.
 *
 * `skip`/`limit` mirror the sibling feeds' pagination: `limit` defaults to 50
 * server-side and is capped at 500, `skip` at the int32 ceiling.
 */
export interface CallbacksFeedParams {
  project_id: number
  date_from?: string // YYYY-MM-DD, inclusive
  date_to?: string // YYYY-MM-DD, inclusive
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
  /** Hide rows whose client was already interacted with today; backend defaults to false. */
  hide_called_today?: boolean
  /** Hide callbacks already worked (by DATE, not by `last_result`); backend defaults to false. */
  hide_worked?: boolean
  skip?: number
  limit?: number
}

/**
 * One callback row (the card's 11 output columns plus `client_id`, `group`
 * renamed to `group_name` — `group` is a reserved SQL word).
 *
 * `interaction_date` and `promise_date` are absolute UTC instants (ISO
 * datetimes with `Z`) — the card baked a `+3h` display shift into the VALUE,
 * the API deliberately does not; the UI formats them in the profile timezone,
 * time included. For THIS feed the time of `promise_date` is the whole point:
 * it is the moment the operator promised to ring back, not a due date.
 *
 * `last_interaction_date` is a bare CALENDAR DAY (YYYY-MM-DD), not an instant
 * — the day of the client's last interaction of any kind. ⚠️ The card calls
 * the column `last_call_date`, which lies: it is not a telephony call. The
 * contract renames it and the UI heads it «Дата останнього ЦД», following
 * Techno-Finance, which had already renamed it on their side.
 *
 * `last_result` is the "worked today" flag as text — always a STRING (the
 * backend coalesces, never null): an EMPTY value means the client has not been
 * worked today, which is a state, not a missing value. Its share swings with
 * the hour of the run (98 % empty at 09:20 against 84 % midday), so an empty
 * column is normal in the morning.
 *
 * `department`/`group_name` are nullable (1–2 % / 13–15 % of production rows:
 * roles without org context) — those rows carry real callbacks and must not be
 * lost; a missing department renders under the localized «Без відділу» label.
 *
 * `link` is the backend's ready-made ABSOLUTE client-card URL. The UI does
 * NOT render it — the table builds the internal `/dashboard/clients/:id`
 * route from `client_id` instead (an in-app navigation, and no dependence on
 * the backend's configured host) — the field simply stays typed because the
 * payload ships it.
 *
 * `client_id` is the row's client (added alongside the card's 11 columns; the
 * backend declares it first in the schema, and JSON key order is irrelevant on
 * the wire) — the source of the client-card route and, paired with the row
 * index, of the table row key.
 */
export interface CallbacksFeedRow {
  inn: string | null
  interaction_date: string // UTC ISO datetime
  interaction_type: string | null
  promise_date: string // UTC ISO datetime — the SCHEDULED callback moment
  employee_interacted: string | null
  employee_responsible: string | null
  link: string
  last_interaction_date: string | null // YYYY-MM-DD calendar day
  last_result: string
  department: string | null
  group_name: string | null
  client_id: number
}

/**
 * Response payload — the sibling feeds' envelope (`rows`/`total`/paging/
 * `generated_at`), with the applied window and both toggles echoed back.
 *
 * `rows` arrive pre-sorted SERVER-side (Card 121 parity: department, group,
 * responsible employee) and the UI never re-sorts: sorting one page of a
 * server-paginated feed would reorder 50 rows out of the whole feed and read
 * as a lie. `total` counts the whole feed, not the page. An empty feed is a
 * normal 200 (a Sunday window holds ~50 callbacks against a weekday's 1400,
 * and `hide_worked` on a past window drains three quarters of it).
 */
export interface CallbacksFeedResponse {
  project_id: number
  date_from: string
  date_to: string
  hide_called_today: boolean
  hide_worked: boolean
  rows: CallbacksFeedRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
  generated_at: string
}
