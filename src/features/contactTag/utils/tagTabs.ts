/**
 * Tag sub-tabs of the «Контакт/Неконтакт» feed.
 *
 * The feed mixes two populations that operators work differently — a client
 * who answers the phone («Контакт», stale after 5 days) and one who does not
 * («Неконтакт», stale after 7) — and the card offers no way to look at one of
 * them alone. The strip is «Всі» (the DEFAULT, the whole picture first) plus
 * one tab per tag, exactly the shape the sibling operator-promises report uses
 * for its departments.
 *
 * ## The strip is a SERVER-side filter
 *
 * The endpoint takes an optional `tag_code` (`kontakt` | `nekontakt`; absent =
 * both populations) and computes `rows`, `total` and `total_pages` over the
 * filtered set. So a tag tab is a FILTER of the whole ~44 000-row feed, not a
 * view of the page on screen: the pager, the totals and the empty state all
 * speak for the tag that is selected, and there is nothing left for the client
 * to sift. That is why this module carries no row-filtering and no counting
 * helper — it only maps the tab the URL names onto the parameter the request
 * sends.
 *
 * ## Keyed by CODE, not by name
 *
 * The one place this deliberately diverges from that sample: operator-promises
 * matches its fixed tabs by department NAME, because there the name IS the
 * product decision ("the department currently called ТП"). Here the backend's
 * own configuration (`CONTACT_TAG_FEED_TAG_CODES`) is written in CODES for a
 * reason the contract spells out — the tag definition ids are not stable across
 * projects (52/53 in project 1, 125/126 in project 6 carry the SAME codes), so
 * `(project_id, code)` is the only unique name a tag has. `tag_name` is a
 * display label the directory can rename at any time; keying tabs on it would
 * empty both of them the day somebody edits «Контакт» to «Контактний».
 *
 * So: send `tag_code`, LABEL from the locale files, and let the table's own tag
 * column carry the live `tag_name` — a renamed tag then shows its new name in
 * the rows while the tabs keep working.
 *
 * ## Why the strip is FIXED at three
 *
 * Unlike departments, the tag pair is a frozen server-side setting rather than
 * a directory that grows on its own, so there is no dynamic half here. Both tag
 * tabs are ALWAYS rendered even when the feed holds none of that tag: a strip
 * whose shape changed with the answer would make "no stale Контакт right now"
 * indistinguishable from "the Контакт tab is gone".
 *
 * A row whose code is neither (only reachable if the backend's code list is
 * reconfigured) is readable on «Всі» ONLY — the same accepted edge as
 * operator-promises' null-department rows, and now the server's own doing:
 * «Всі» sends no `tag_code` at all, so it is the tab that asks for every
 * population the endpoint knows about. Nothing is hidden: «Всі» is the default
 * tab, and the table's tag column names the tag on every row.
 */

/**
 * The tabs, in display order: the aggregate first, then the two tags. Ids are
 * stable — they travel in the URL (`?kg=`) and name the i18n label keys — and
 * the two tag ids are the backend's own `CONTACT_TAG_FEED_TAG_CODES` verbatim,
 * so the URL value and the wire value are the same string.
 */
export const CONTACT_TAG_TAB_IDS = ['all', 'kontakt', 'nekontakt'] as const

export type ContactTagTabId = (typeof CONTACT_TAG_TAB_IDS)[number]

/**
 * The default tab — the full picture. It is never written to the URL (see the
 * tab component): an absent `?kg=` means «Всі», so a shared link stays clean
 * and cannot pin a choice nobody made.
 */
export const DEFAULT_CONTACT_TAG_TAB: ContactTagTabId = 'all'

/**
 * Tab id → the `tag_code` the request carries. `all` maps to null: it is not a
 * tag but the ABSENCE of the parameter, which is why it also returns the rows
 * no other tab shows — a row whose code is outside the configured pair above
 * all.
 */
const TAB_TAG_CODE: Record<ContactTagTabId, string | null> = {
  all: null,
  kontakt: 'kontakt',
  nekontakt: 'nekontakt',
}

export function isContactTagTab(tabId: string): tabId is ContactTagTabId {
  return (CONTACT_TAG_TAB_IDS as readonly string[]).includes(tabId)
}

/**
 * `?kg=` → the tab to show. An unknown or absent value degrades to «Всі»
 * rather than to an empty screen, and the fallback is a pure derivation that is
 * never written back to the URL: rewriting it would destroy a deep link the
 * moment it was opened, and a stale view preference is harmless.
 *
 * Load-bearing for the REQUEST now, not only for the strip: an unknown `?kg=`
 * resolving to «Всі» is also what keeps a hand-edited link from sending a code
 * the endpoint answers 400 for.
 */
export function resolveContactTagTab(raw: string | null): ContactTagTabId {
  return raw !== null && isContactTagTab(raw) ? raw : DEFAULT_CONTACT_TAG_TAB
}

/**
 * The tab as a REQUEST parameter — an object to spread, the same shape (and for
 * the same reason) as `sellToRequestParam`: «Всі» must send no `tag_code` KEY
 * at all, and `{ tag_code: undefined }` is a different thing from an omission
 * for anything that hashes the params object — the query key above all, where
 * an `undefined` member and a missing one must not be allowed to drift apart.
 */
export function tagTabRequestParam(tabId: ContactTagTabId): { tag_code?: string } {
  const code = TAB_TAG_CODE[tabId]
  return code === null ? {} : { tag_code: code }
}
