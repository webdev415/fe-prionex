/**
 * Promises Feed API Types
 *
 * Backend contract for GET /api/v1/clients/reports/feeds/promises
 * (client-service, «Обіцянки», migrated Metabase Card 119): the row-by-row
 * feed of promises whose PROMISED date falls inside the window, with the two
 * Techno-Finance toggles (hide worked / hide paid).
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `date_from`/`date_to` bound the PROMISED-date calendar day (cut in
 * `timezone`) and are inclusive; the backend defaults them to "today" in
 * `timezone` when omitted, caps the difference at 366 days and answers 400 on
 * an inverted pair. The tab always sends both — its default window is
 * today–today in the profile timezone (Techno-Finance parity: the card's
 * default is today in Kyiv) — so the omission branch exists here only because
 * the API supports it.
 *
 * `hide_worked`/`hide_paid` are SERVER-side filters (backend default false):
 * the feed is paginated, so hiding client-side would tear holes in pages.
 * `hide_worked` drops rows already worked today (`last_result` non-empty),
 * `hide_paid` drops rows whose promise window already saw a payment
 * (`payment_amount` non-zero).
 *
 * `skip`/`limit` mirror the sibling feeds' pagination: `limit` defaults to 50
 * server-side and is capped at 500, `skip` at the int32 ceiling.
 */
export interface PromisesFeedParams {
  project_id: number
  date_from?: string // YYYY-MM-DD, inclusive
  date_to?: string // YYYY-MM-DD, inclusive
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
  /** Hide promises already worked today; backend defaults to false. */
  hide_worked?: boolean
  /** Hide promises already paid; backend defaults to false. */
  hide_paid?: boolean
  skip?: number
  limit?: number
}

/**
 * One promise row (the card's 12 output columns plus `client_id`, `group`
 * renamed to `group_name` — `group` is a reserved SQL word).
 *
 * `interaction_date` and `promise_date` are absolute UTC instants (ISO
 * datetimes with `Z`) — the card baked a `+3h` display shift into the VALUE,
 * the API deliberately does not; the UI formats them in the profile timezone,
 * time included (promises carry real times of day: 09:00/12:30/21:00).
 *
 * `promise_amount`/`payment_amount` are exact `Decimal` server-side and
 * therefore serialise as JSON STRINGS ("1500.00"); the union with `number`
 * covers a payload that ever ships them unquoted. Both are coalesced to 0
 * server-side, never null.
 *
 * `last_result` is the "worked today" flag as text — always a STRING (the
 * backend coalesces, never null): an EMPTY value means the promise has not
 * been worked yet, which is a state, not a missing value.
 *
 * `department`/`group_name` are nullable (12 %/16 % of production rows: roles
 * without org context) — those rows carry real promises and must not be lost;
 * a missing department renders under the localized «Без відділу» label.
 *
 * `link` is the backend's ready-made ABSOLUTE client-card URL. The UI does
 * NOT render it — the table builds the internal `/dashboard/clients/:id`
 * route from `client_id` instead (an in-app navigation, and no dependence on
 * the backend's configured host) — the field simply stays typed because the
 * payload ships it.
 *
 * `client_id` is the row's client (the schema's 13th field) — the source of
 * the client-card route and, paired with the row index, of the table row key.
 */
export interface PromisesFeedRow {
  inn: string | null
  interaction_date: string // UTC ISO datetime
  interaction_type: string | null
  promise_date: string // UTC ISO datetime
  promise_amount: string | number
  employee_interacted: string | null
  employee_responsible: string | null
  link: string
  payment_amount: string | number
  last_result: string
  department: string | null
  group_name: string | null
  client_id: number
}

/**
 * Response payload — the sibling feeds' envelope (`rows`/`total`/paging/
 * `generated_at`), with the applied window and both toggles echoed back.
 *
 * `rows` arrive pre-sorted SERVER-side (Card 119 parity: department, group,
 * responsible employee) and the UI never re-sorts: sorting one page of a
 * server-paginated feed would reorder 50 rows out of the whole feed and read
 * as a lie. `total` counts the whole feed, not the page. An empty feed is a
 * normal 200 (both toggles on can legitimately drain a day).
 */
export interface PromisesFeedResponse {
  project_id: number
  date_from: string
  date_to: string
  hide_worked: boolean
  hide_paid: boolean
  rows: PromisesFeedRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
  generated_at: string
}
