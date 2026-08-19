/**
 * Operator Promises Report API Types
 *
 * Backend contract for GET /api/v1/clients/reports/operator-promises
 * (client-service, «Обіцянки по операторах», migrated Metabase Card 102).
 * Mirrors services/client/app/schemas/operator_promises_report.py,
 * services/client/app/routers/reports.py and docs/operator-promises-report.md.
 *
 * The report answers "what did each operator promise, and what actually
 * arrived?" — one row per OPERATOR (not per client, not per promise).
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `date_from`/`date_to` are BOTH REQUIRED and inclusive: unlike every sibling
 * report tab, this endpoint has no default period at all, because all three of
 * its windows are cut by the same pair (see `OperatorPromisesRow`). The
 * frontend therefore always sends a window — today–today by default, which is
 * what Techno-Finance's «Обещания» panel defaults to as well.
 *
 * `timezone` moves the PROMISED-date cut only, and nothing else: the
 * interaction window keeps a UTC cut (Card 102 parity) and `payments.payment_date`
 * is a DATE column with no instant to re-express. Sending the profile zone
 * reproduces the card for summer dates (`Europe/Kyiv`); omitting it makes the
 * backend default to UTC.
 *
 * There is no pagination and no department filter — the backend returns every
 * department (including a null one) and the frontend groups into its own tabs.
 */
export interface OperatorPromisesReportParams {
  project_id: number
  date_from: string // YYYY-MM-DD, inclusive
  date_to: string // YYYY-MM-DD, inclusive
  timezone?: string
}

/**
 * One operator's promises and collections inside the report window.
 *
 * The THREE WINDOWS are independent and all cut by the same date pair, which is
 * the report's central subtlety:
 * - `interactions_count` / `sum_from` — what the operator DID in the period
 *   (cut on the interaction's `created_at`, UTC);
 * - `sum_to` — what was DUE in the period (cut on the promised payment date,
 *   in the requested timezone), whenever the promise was taken;
 * - `paid_full` / `paid_verified` — what ARRIVED in the period (cut on
 *   `payments.payment_date`, a plain DATE).
 *
 * So `conversion` is "money collected ÷ money due", NOT "share of promises
 * kept": a payment is never matched to the promise it settles. It legitimately
 * exceeds 1 (production maximum 8.15 for July 2026) and `unpaid` legitimately
 * goes negative — that is an overpaying operator, not a bug.
 *
 * `verified_unpaid` / `verified_conversion` are the same two formulas over
 * `paid_verified` (backend contract since 2026-08-19 — full column parity with
 * Techno-Finance, which renders both trios). They are NOT derived here: a money
 * metric has one definition, and it lives on the server.
 *
 * `fio`, `department` and `group_name` come from the auth directory and are all
 * nullable: an operator with no role/department membership in the project keeps
 * their row (the report has NO department filter, and those "extra" departments
 * carry real money — Юристи + Аналітики + no-department held ≈ 631 000 ₴ of
 * July 2026 collections, which the Techno-Finance frontend silently drops).
 *
 * `is_active` mirrors the directory's employment status at REQUEST time, not at
 * any point inside the window: a dismissed operator KEEPS their row by default
 * (business decision 2026-08-19 — «деньги не должны исчезать из отчёта»; the
 * card hid 859 523.80 ₴ this way). It is display-only and never a filter here.
 *
 * Money is exact `Decimal` server-side and therefore serialises as JSON
 * STRINGS ("112062.00"); the union with `number` covers a payload that ever
 * ships it unquoted. `conversion` is a SHARE rounded to six decimals (the
 * frontend multiplies by 100) and is `null` for every zero denominator.
 *
 * A row can legitimately be all zeros: an operator whose interactions are all
 * outside the window is still listed (card parity — the base query has no date
 * filter, 13 such "roster" rows in the July 2026 sample), and so is an operator
 * who only collected money in the window.
 */
export interface OperatorPromisesRow {
  user_id: number
  fio: string | null
  department: string | null
  group_name: string | null
  is_active: boolean
  /** Chain runs FIRST touched in the window — not interaction rows. */
  interactions_count: number
  /** Σ promised amounts of the chain runs first touched in the window. */
  sum_from: string | number
  /** Σ promised amounts whose PROMISED DATE falls in the window. */
  sum_to: string | number
  /** Σ non-cancelled payments of the window — pending payments included. */
  paid_full: string | number
  /** Σ verified payments of the window; always <= `paid_full`. */
  paid_verified: string | number
  /** `sum_to - paid_full`: POSITIVE means still owed, negative means overpaid. */
  unpaid: string | number
  /** `paid_full / sum_to` as a share; null when `sum_to` is 0. */
  conversion: string | number | null
  /** `sum_to - paid_verified` — the verified twin of `unpaid`, same sign rule. */
  verified_unpaid: string | number
  /** `paid_verified / sum_to` as a share; null when `sum_to` is 0. */
  verified_conversion: string | number | null
}

/**
 * The report's own totals, summed over EVERY row of the response — dismissed
 * operators and the departments this tab does not show included.
 *
 * They are deliberately NOT a per-department subtotal: the frontend groups rows
 * into its department tabs and recomputes its own visible subtotals from them,
 * exactly as Techno-Finance does. Both figures are shown side by side so a
 * department tab never reads as "this is the whole period".
 *
 * Both conversions are recomputed server-side as `Σ paid / Σ sum_to` rather than
 * averaged — a ratio cannot be summed — and are null when nothing was due.
 */
export interface OperatorPromisesTotals {
  operators: number
  interactions_count: number
  sum_from: string | number
  sum_to: string | number
  paid_full: string | number
  paid_verified: string | number
  unpaid: string | number
  conversion: string | number | null
  verified_unpaid: string | number
  verified_conversion: string | number | null
}

/**
 * Response payload. NOT paginated: one row per operator (136 for July 2026 on
 * production), which the frontend renders in full.
 *
 * `rows` arrive pre-sorted by `department` → `group_name` → `fio` → `user_id`,
 * ascending, with a NULL department or group sorting LAST. `is_active`
 * deliberately does not participate — a dismissed operator stays in their
 * department and group, marked rather than herded to the bottom. The UI never
 * re-sorts them.
 *
 * `timezone` echoes the IANA zone actually applied ("UTC" when the caller sent
 * none). `generated_at` is stamped when the rows were COMPUTED, not when they
 * were served: a computed report is re-served from a worker-local cache for 15
 * minutes, so a hit states its own age instead of claiming to be new.
 */
export interface OperatorPromisesReportResponse {
  project_id: number
  date_from: string
  date_to: string
  timezone: string
  rows: OperatorPromisesRow[]
  totals: OperatorPromisesTotals
  generated_at: string
}
