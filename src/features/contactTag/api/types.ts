/**
 * Contact-Tag Feed API Types
 *
 * Backend contract for GET /api/v1/clients/reports/feeds/contact-tag
 * (client-service, «Контакт/Неконтакт», migrated Metabase Card 124). Mirrors
 * services/client/app/schemas/contact_tag_feed.py and
 * docs/contact-tag-feed.md.
 *
 * The feed answers "which tagged clients has nobody touched for longer than
 * their tag allows?" — one row per CLIENT. "Touched" means BOTH an interaction
 * and a re-assignment: a client nobody has spoken to in a month but who was
 * handed to a new operator yesterday is that operator's fresh work, not
 * neglect, and is therefore absent. A client with a live promise (or a
 * promised call-back — this card's promise list is wider than the sibling
 * Card 125 feed's) is absent for the same reason.
 *
 * The closest sibling by SHAPE is the Card 125 feed («Великий розрив»): the
 * same client/employee/debt columns, the same date cuts, the same
 * Decimal-as-string money. What is new here is the tag pair and the date
 * model — see below.
 */

/**
 * Query params in backend (snake_case) format.
 *
 * THE DATE MODEL IS NOT THE FEEDS' USUAL ONE, and the asymmetry is ported
 * deliberately rather than "cleaned up" (docs/contact-tag-feed.md, "The
 * asymmetric sell window"):
 *
 * - `view_date` is **REQUIRED**. It is the day the feed is computed AS OF:
 *   both staleness thresholds (5 days for `kontakt`, 7 for `nekontakt`) and
 *   the promise gate are measured against it, so there is no defensible
 *   backend default. Absent → 422;
 * - `sell_from` bounds the client's LAST debt purchase date from below and has
 *   **no default**: absent and empty mean the same thing (no lower bound), so
 *   the tab simply omits the key when it is unset;
 * - `sell_to` bounds it from above and has **three** wire states, which is the
 *   whole reason this type spells it `string` rather than an optional date:
 *
 *   | `sell_to` on the wire | applied | echoed in the response |
 *   |---|---|---|
 *   | key ABSENT            | the last day of the month FOUR months before `view_date`'s month | that date |
 *   | `sell_to=` (EMPTY)    | no upper bound | `null` |
 *   | `sell_to=2026-06-30`  | that date | that date |
 *
 *   Both bounds arrive at the backend as raw STRINGS precisely so it can tell
 *   "absent" from "empty" — a `date` query parameter would answer 422 for an
 *   empty one and hand the handler the same `None` it hands it for an absent
 *   one. So an empty `sell_to` must reach axios as `''`, never as `undefined`
 *   (which axios drops) and never as `null` (which it drops too). The tab's
 *   state machine lives in `utils/sellWindow.ts`.
 *
 * Because `sell_to` has a default, an INVERTED window is reachable without a
 * single bad value — "purchased since last month" against a default upper
 * bound four months back. The backend answers 400 naming the APPLIED `sell_to`
 * and the empty-string escape hatch, and the tab shows that detail verbatim:
 * the frontend deliberately does not re-implement the month arithmetic to
 * pre-empt it (see the tab's docblock).
 *
 * A malformed bound is a **400**, not a 422 — one predictable code per class of
 * bad input. `skip`/`limit` mirror the client-listing pagination of the same
 * service: `limit` defaults to 50 server-side and is capped at 500. The feed
 * is ~44 000 rows (~880 pages at the default limit), so paging is not optional
 * here the way it is for the tiny sibling feeds.
 */
export interface ContactTagFeedParams {
  project_id: number
  /** REQUIRED reference day, YYYY-MM-DD. */
  view_date: string
  /** YYYY-MM-DD; omit the key entirely for "no lower bound". */
  sell_from?: string
  /**
   * YYYY-MM-DD, or `''` to switch the upper bound OFF. Omitting the key is a
   * THIRD, different state: it applies the backend's month−4 default.
   */
  sell_to?: string
  skip?: number
  limit?: number
  /** IANA timezone of the user's profile; the backend defaults to UTC when omitted. */
  timezone?: string
}

/**
 * One stale tagged client, with its responsible employee's org labels.
 *
 * `tag_code` is the STABLE key (`kontakt` / `nekontakt`) and is what the
 * sub-tab strip filters by; `tag_name` is the display label the backend read
 * out of the tag directory («Контакт» / «Неконтакт») and is what the table
 * renders. The card returns only the name — the code exists in this contract
 * precisely because the tag definition ids are not stable across projects (52
 * and 53 in project 1, 125 and 126 in project 6), so a name is the only thing
 * a UI could otherwise key on, and names get renamed.
 *
 * `tag_name` is nullable: a directory payload carrying a non-string label
 * degrades that ONE cell rather than taking the work list down. `tag_code` is
 * not — a row whose code is not among the resolved definitions is dropped
 * server-side, never emitted "untagged".
 *
 * Two dates are structurally NON-NULL, and that is structural rather than
 * optimistic: the population filter compares BOTH `last_interaction_date` and
 * `assignment_date` against `view_date - threshold`, and a NULL on either side
 * makes that comparison NULL — which is not true, so the client is not in the
 * feed at all.
 *
 * Each date column carries a deliberately DIFFERENT server-side cut, which is
 * why none of them is ever shifted client-side:
 * - `sell_date` — a plain DATE column with no zone at all. Computed over ALL
 *   of the client's debts including closed ones (card parity), so it says when
 *   the portfolio was last bought, not when the live debt was. Null when the
 *   latest debt row carries no purchase date;
 * - `assignment_date` — cut in the requested `timezone` (the card hardcodes
 *   `+ interval '3 hours'`, i.e. Kyiv summer time; `Europe/Kyiv` reproduces it);
 * - `last_planed_interaction_date` — the last recorded promise / call-back
 *   day, cut in the requested `timezone`. Null on most rows BY DESIGN: a
 *   client is in this feed precisely because nobody extracted a promise;
 * - `last_interaction_date` — cut in **UTC** whatever timezone was requested,
 *   which is card parity (the card cuts that column in UTC too). Unlike the
 *   three sibling feeds, this one's "last interaction" ignores NO chain: here
 *   ANY recorded touch means somebody touched the client.
 *
 * `body_amount` is the sum of the principals of the client's ACTIVE debts. It
 * is an exact `Decimal` (money is never a float) and therefore arrives as a
 * JSON STRING, e.g. `"15000.00"`. The card spells the column `body_ammount`;
 * the typo is not carried over.
 *
 * `inn` (`clients.tax_id`) is application-enforced only, hence nullable;
 * `employee_name` / `department` / `group_name` are nullable because the auth
 * directory may not know the account or it may have no membership in the
 * project. `department` and `group_name` can carry the card's two "shelf"
 * display overrides — unlike the Card 125 feed, where every account they name
 * is also blacklisted and the branches are dead, this card's blacklist is five
 * ids and holds none of the four shelf accounts.
 *
 * `employee_id` is carried alongside the name (the card identifies the
 * responsible employee by a concatenated string only, which is what blocked
 * RBAC scoping in the source system) and is deliberately not a table column:
 * it is a key, not a fact an operator reads — the same choice the sibling
 * feeds make.
 */
export interface ContactTagFeedRow {
  client_id: number
  inn: string | null
  /** Stable key: `kontakt` | `nekontakt` (configurable server-side). */
  tag_code: string
  /** Localized display label from the tag directory. */
  tag_name: string | null
  sell_date: string | null // YYYY-MM-DD
  assignment_date: string // YYYY-MM-DD
  last_planed_interaction_date: string | null // YYYY-MM-DD
  employee_id: number
  employee_name: string | null
  /** Exact Decimal serialised as a JSON string, e.g. "15000.00". */
  body_amount: string
  last_interaction_date: string // YYYY-MM-DD
  department: string | null
  group_name: string | null
}

/**
 * Response payload.
 *
 * `view_date` echoes the required reference day. `sell_from` / `sell_to` echo
 * the window that was APPLIED, which is not always the one that was asked for
 * — an absent `sell_to` comes back as the backend's month−4 default and an
 * empty one comes back `null`. That echo is the ONLY honest source for "what
 * upper bound is actually in force", and the tab renders it rather than
 * recomputing the month arithmetic locally.
 *
 * `rows` come pre-sorted by the responsible employee's display name, then
 * `last_interaction_date` DESCENDING (card parity — the most recently touched
 * first inside each employee's block), then `client_id`. The last key is
 * load-bearing rather than decorative: one employee's clients share a name and
 * cluster on a handful of interaction days, so without it two pages could show
 * the same client and skip another — over a feed ~880 pages long. The sort is
 * fixed SERVER-side and the UI never re-sorts.
 *
 * `total` counts the whole feed, not the returned page, and stays stable
 * across pages. An empty feed is a normal 200 (zero tagged clients and zero
 * surviving candidates both answer 200, not an error).
 *
 * `generated_at` is stamped when the rows were COMPUTED, not when they were
 * served — the feed is cached for 15 minutes per worker (parity with the
 * source system's own figure for this card). It is deliberately NOT rendered,
 * the same choice the three sibling feed tabs make: production runs eight
 * client-service workers with independent caches, so two refreshes can be
 * answered by two workers and show two stamps in either order, which is worse
 * than showing none. The window echo above is what tells the operator what
 * they are looking at.
 */
export interface ContactTagFeedResponse {
  project_id: number
  view_date: string // YYYY-MM-DD
  sell_from: string | null // YYYY-MM-DD, applied
  sell_to: string | null // YYYY-MM-DD, applied (null = upper bound switched off)
  rows: ContactTagFeedRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
  generated_at: string
}
