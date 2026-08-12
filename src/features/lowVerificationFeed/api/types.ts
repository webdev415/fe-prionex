/**
 * Low-Verification Feed API Types
 *
 * Backend contract for GET /api/v1/clients/reports/feeds/low-verification
 * (client-service, «Мало верифікацій 3-х осіб», migrated Metabase Card 148).
 * Mirrors services/client/app/schemas/low_verification_feed.py and
 * docs/low-verification-feed.md.
 */

/**
 * Query params in backend (snake_case) format.
 *
 * `sell_from`/`sell_to` are optional AND independent: either may be sent
 * without the other (the card's two separate `[[…]]` blocks). They can only
 * NARROW the feed's built-in floor — the last debt purchase not older than
 * `LOW_VERIFICATION_MONTHS_FLOOR` months — never widen it, which is also why
 * this endpoint has no 366-day window cap (unlike the two sibling reports).
 *
 * `max_verified` is optional and `>= 0`; `0` ("never verified since the
 * purchase") is the useful extreme and must survive every falsy check on the
 * way to the wire.
 *
 * `skip`/`limit` mirror the client-listing pagination of the same service:
 * `limit` defaults to 50 server-side and is capped at 500.
 */
export interface LowVerificationFeedParams {
  project_id: number
  sell_from?: string // YYYY-MM-DD
  sell_to?: string // YYYY-MM-DD
  max_verified?: number
  skip?: number
  limit?: number
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
}

/**
 * One client of the feed, labelled with its responsible employee's org data.
 *
 * `verified_count` counts the client's verified third-party contacts added no
 * earlier than its LAST debt purchase, so a repeat purchase resets it to zero
 * (frozen Card 148 semantics).
 *
 * Date cuts are deliberately asymmetric and must NOT be re-shifted here:
 * `sell_date` is a plain DATE column with no timezone, `assignment_date` is cut
 * in the requested `timezone`, and `last_interaction_date` keeps the card's UTC
 * cut whatever timezone was requested.
 *
 * `inn` and `assignment_date` are non-NULL for every production row today but
 * are typed optional per the backend schema (`clients.tax_id` is only
 * application-enforced, and a client can predate the assignment log).
 * `last_interaction_date` is null for ~36 % of rows. `body_amount` is an exact
 * `Decimal` and therefore serialises as a JSON STRING ("15000.00"); the union
 * with `number` covers a payload that ever ships it unquoted.
 */
export interface LowVerificationFeedRow {
  client_id: number
  inn: string | null
  employee_id: number
  full_name: string
  department: string
  group_name: string | null
  sell_date: string // YYYY-MM-DD
  assignment_date: string | null
  last_interaction_date: string | null
  body_amount: number | string
  verified_count: number
}

/**
 * Response payload. `sell_from`/`sell_to`/`max_verified` echo the filters that
 * were applied and stay null when not requested.
 *
 * `total` counts the whole filtered feed (not the returned page) and stays
 * stable across pages. `rows` come pre-sorted by `verified_count` ascending,
 * then the employee's full name, then `client_id` — the UI never re-sorts them.
 *
 * An empty feed is a normal 200: the months floor drains it between purchase
 * batches.
 */
export interface LowVerificationFeedResponse {
  project_id: number
  sell_from: string | null
  sell_to: string | null
  max_verified: number | null
  rows: LowVerificationFeedRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
  generated_at: string
}
