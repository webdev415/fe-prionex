/**
 * Third-Party Verification Report API Types
 *
 * Backend contract for GET /api/v1/clients/reports/third-party-verification
 * (client-service, "Верифікація 3-х осіб" report, migrated Metabase Card 128).
 * Mirrors services/client/app/schemas/third_party_verification.py.
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `sell_from`/`sell_to` are required TOGETHER by the backend (one alone
 * answers 400), so the client always sends both — defaulted to the current
 * month in the profile timezone. With a profile timezone set that matches the
 * backend's own default; without one the FE resolves the month in the browser
 * timezone while the backend would use UTC — moot, since the window is never
 * left to the backend.
 *
 * `count_from`/`count_to` are optional AND independent: either may be sent
 * without the other (open-ended contact-date bound).
 */
export interface ThirdPartyVerificationParams {
  project_id: number
  sell_from: string // YYYY-MM-DD
  sell_to: string // YYYY-MM-DD
  count_from?: string // YYYY-MM-DD
  count_to?: string // YYYY-MM-DD
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
}

/**
 * One ТП operator's verification fact and monthly plan.
 *
 * `numbers_added` counts verified third-party contact ROWS, `unique_clients`
 * the distinct clients behind them (`unique_clients <= numbers_added`).
 *
 * `month_plan` / `month_plan_diff` are backend `Decimal`s: FastAPI may
 * serialise them either as a JSON number or as a JSON string ("1198.8"),
 * hence the union — every consumer coerces through `toFiniteNumber`. They are
 * `null` when the plan is undefined (zero active ТП headcount for the
 * window); the UI then renders "—" with no fill and no colour.
 *
 * Counters are typed non-nullable per the contract but still guarded at the
 * render site: an unexpected null/undefined must degrade to "—", never crash
 * the tab.
 */
export interface ThirdPartyVerificationRow {
  user_id: number
  full_name: string
  group_name: string | null
  numbers_added: number
  unique_clients: number
  month_plan: number | string | null
  month_plan_diff: number | string | null
}

/**
 * Response payload. `sell_from`/`sell_to` echo the effective window;
 * `count_from`/`count_to` stay null when not requested. `rows` come
 * pre-sorted by `numbers_added` descending (Card 128 parity) — the UI never
 * re-sorts them.
 */
export interface ThirdPartyVerificationResponse {
  project_id: number
  sell_from: string
  sell_to: string
  count_from: string | null
  count_to: string | null
  rows: ThirdPartyVerificationRow[]
  generated_at: string
}
