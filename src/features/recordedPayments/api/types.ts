/**
 * Recorded Payments Feed API Types
 *
 * Backend contract for GET /api/v1/payments/reports/feeds/recorded-payments
 * (PAYMENT service, «Внесені платежі», migrated Metabase Card 76): the list
 * of payments whose BANK confirmation date (`payments.payment_confirmation_date`)
 * falls inside the window. Mirrors
 * `services/payment/app/schemas/recorded_payments_feed.py` and
 * `docs/recorded-payments-feed.md` in api-prionex (PR #538).
 *
 * ONE ROW IS ONE PAYMENT (`payment_id`, the primary key): no collapse, no
 * duplicates — 7 446 rows were 7 446 distinct ids on the August-2026 window.
 *
 * THE OPERATOR AXIS IS NOT THE ONE THE ROW'S COLUMNS SUGGEST, and it is the
 * one thing to know about this feed. The source system (Techno-Finance) opens
 * this list from its per-operator KPI table and filters it by the client's
 * RESPONSIBLE employee — `clients.responsible_employee_id`, "key B" — while
 * the KPI row it was opened from counts the same payments by
 * `coalesce(assigned_user_id, recorded_by_user_id)`, "key A". The two keys
 * disagree on 43 % of August's rows and 52 % of its money, mostly because
 * key B credits 2 637 rows / 11 605 473.83 ₴ to the service account «Договор
 * закрыт » (`user_id` 6274). The owner's decision of 2026-09-28 is PARITY WITH
 * THE SOURCE SYSTEM: `user_ids` and `operator_breakdown` are on key B, matched
 * by `user_id` and NEVER by a name string; key A stays on every row as two
 * plain columns (`assigned_user_id`, `recorded_by_user_id`).
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `date_from`/`date_to` bound the bank confirmation date — a DATE column, so
 * the window is an honest closed range of calendar days that `timezone` cannot
 * move — and are BOTH-OR-NEITHER: omitting both means the CURRENT MONTH in
 * `timezone` (the 1st .. today), exactly one answers 400
 * (`DATE_RANGE_INCOMPLETE`). The tab always sends both, so the server default
 * never applies, but the zone still travels on every request (the contract's
 * «Frontend expectations»). There is NO all-history mode. A difference over
 * 366 days answers 400 (`DATE_RANGE_TOO_LONG`), as does an inverted pair
 * (`DATE_RANGE_INVERTED`).
 *
 * `user_ids` filters by the client's RESPONSIBLE employee (key B), at most 200
 * ids (`USER_IDS_TOO_MANY`, `params.max_ids`), each inside `1..2147483647`
 * (`USER_IDS_OUT_OF_RANGE`, `params.min`/`params.max`). On a window past the
 * distinct-client cap the filter cannot be resolved and is refused with 400
 * `BREAKDOWN_WINDOW_TOO_WIDE` (`params.max_clients`). Sent as REPEATED keys
 * (`user_ids=1&user_ids=2`), the form FastAPI reads a list from.
 *
 * `verified_only` is the «Тільки підтверджені» switch: `true` keeps
 * `status = 'verified'` only; the backend default `false` lists ALL statuses,
 * i.e. `cancelled` payments too (43 rows / 170 288.02 ₴ in August), which is
 * what the source system's popup shows with its toggle off. `pending` never
 * appears in either mode — it has no confirmation date.
 *
 * `skip`/`limit` are DB-side paging (`LIMIT/OFFSET` under `ORDER BY
 * payment_confirmation_date DESC, id DESC`); `limit` defaults to 50 and is
 * capped at 200 — the page is the enrichment cap — which is lower than the
 * client-service feeds' 500.
 */
export interface RecordedPaymentsFeedParams {
  project_id: number
  /** YYYY-MM-DD, inclusive. Both bounds or neither — neither = the current month. */
  date_from?: string
  /** YYYY-MM-DD, inclusive. Both bounds or neither — neither = the current month. */
  date_to?: string
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
  /** Key B filter — the client's responsible employee, by id; ≤ 200. */
  user_ids?: number[]
  /** `true` → `status = 'verified'` only; backend default false = all statuses. */
  verified_only?: boolean
  skip?: number
  limit?: number
}

/**
 * One payment — the card's fifteen columns in the card's order, minus the
 * hardcoded link (the UI builds it from `client_id`), plus what the owner's
 * decisions add.
 *
 * BOTH DATES ARE ON THE ROW (decision Q4): `payment_confirmation_date` is the
 * window's anchor (the bank date, a bare calendar day) and `verified_at` is
 * what the card DISPLAYS (the CRM confirmation instant, UTC). They differ on
 * 2.2 % of August's rows and 64 of those show a `verified_at` LATER than the
 * window's end (up to +9 days) — a report for August legitimately shows
 * "confirmed 2026-09-03". The table formats the instant in the profile zone.
 *
 * `client_responsible_user_id` / `..._full_name` / `..._is_service` are KEY B
 * — the axis of `user_ids` and of the breakdown; null when the tenant-scoped
 * client lookup did not return the client (another project, or unknown), in
 * which case `inn` is null too and the row STAYS in the list.
 * `assigned_user_id` / `recorded_by_user_id` are KEY A, as two explicit
 * columns; the card's single «Ответственный по платежу» is folded from them
 * by ID in `../lib/paymentResponsible`.
 *
 * A `null` `*_full_name` next to a non-null `*_user_id` is a SOFT-DELETED
 * employee: `GET /users/batch` filters `is_deleted = false`, so the name is
 * gone while the id stays. The UI renders the id, not «—».
 *
 * `client_is_deleted`: a soft-deleted client's payments stay (soft delete has
 * no cascade, KAN-902); the flag lets the page mark them.
 *
 * `amount` is an exact `Decimal` server-side and therefore serialises as a
 * JSON STRING ("1500.00"); the union with `number` covers a payload that ever
 * ships it unquoted (the promises feed's precedent). No arithmetic on it here.
 *
 * `payment_type` is the card's `coalesce(company_code, payment_comment)` and
 * the one leaky column — NULL on 4.7 % of rows, which is data, not a fault.
 * `seller_name` is `sellers.seller_name` through the debt directory (equal to
 * the card's legacy string on 100 % of August rows, decision Q6).
 */
export interface RecordedPaymentRow {
  payment_id: number
  client_id: number
  client_is_deleted: boolean
  debt_id: number | null
  contract_number: string | null
  inn: string | null
  amount: string | number
  payment_date: string | null // YYYY-MM-DD calendar day
  payment_confirmation_date: string // YYYY-MM-DD calendar day — the window's anchor
  verified_at: string | null // UTC ISO datetime — what the card displays
  status: string // verified | cancelled (pending never appears)
  recorded_by_user_id: number | null
  recorded_by_full_name: string | null
  assigned_user_id: number | null
  assigned_full_name: string | null
  client_responsible_user_id: number | null
  client_responsible_full_name: string | null
  client_responsible_is_service: boolean
  purchase_date: string | null // YYYY-MM-DD calendar day
  seller_name: string | null
  payment_method: string
  payment_type: string | null
}

/**
 * Count and sum over the WHOLE filtered selection, never the page.
 * `rows_count` equals the envelope's `total`; `total_amount` is what the
 * breakdown lines add up to whenever the breakdown is neither capped nor
 * truncated.
 */
export interface RecordedPaymentsSummary {
  rows_count: number
  total_amount: string | number
}

/**
 * One responsible employee's (key B) count and sum over the WHOLE selection.
 *
 * `user_id` is null for payments whose client the directory did not return a
 * responsible for — kept as a line rather than dropped so the lines still add
 * up to the summary; such a line can never be filtered on. `is_service`
 * marks the configured service accounts (the «Договор закрыт » pseudo-employee,
 * 35 % of August's rows on this axis): an ORDINARY line of the breakdown,
 * flagged — never hidden, never merged (decision Q8).
 */
export interface OperatorBreakdownLine {
  user_id: number | null
  full_name: string | null
  is_service: boolean
  rows_count: number
  amount: string | number
}

/**
 * Response payload — the feed family's envelope plus the echo of the applied
 * filters, the whole-selection summary and the key-B breakdown.
 *
 * `date_from`/`date_to` echo the applied window (defaulted when omitted) and
 * are never null — this feed has no all-history mode. `user_ids` echoes the
 * filter sorted and de-duplicated.
 *
 * `breakdown_capped` is true when the window held more distinct clients than
 * the feed resolves responsibles for (20 000): the breakdown is then EMPTY
 * rather than partial — the UI shows a notice, not an empty table — while
 * `summary` and `rows` are still served. `breakdown_truncated` is true when
 * more than 500 operators had lines and only the top 500 by amount are
 * returned. Rows arrive pre-sorted server-side; the UI never re-sorts.
 *
 * `generated_at` is when the rows were computed; no cache, no snapshot.
 */
export interface RecordedPaymentsFeedResponse {
  project_id: number
  date_from: string
  date_to: string
  timezone: string
  verified_only: boolean
  user_ids: number[]
  rows: RecordedPaymentRow[]
  summary: RecordedPaymentsSummary
  operator_breakdown: OperatorBreakdownLine[]
  breakdown_capped: boolean
  breakdown_truncated: boolean
  total: number
  page: number
  page_size: number
  total_pages: number
  generated_at: string
}
