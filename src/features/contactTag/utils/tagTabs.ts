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
 * So: filter by `tag_code`, LABEL from the locale files, and let the table's
 * own tag column carry the live `tag_name` — a renamed tag then shows its new
 * name in the rows while the tabs keep working.
 *
 * ## Why the strip is FIXED at three
 *
 * Unlike departments, the tag pair is a frozen server-side setting rather than
 * a directory that grows on its own, so there is no dynamic half here. Both tag
 * tabs are ALWAYS rendered even when the current page holds none of that tag:
 * a strip whose shape changed with the page would make "no stale Контакт here"
 * indistinguishable from "the Контакт tab is gone".
 *
 * A row whose code is neither (only reachable if the backend's code list is
 * reconfigured) is readable on «Всі» ONLY — the same accepted edge as
 * operator-promises' null-department rows. Nothing is hidden: «Всі» is the
 * default tab, and the table's tag column names the tag on every row.
 *
 * ## Counts are PAGE-scoped, and that is not a detail
 *
 * The other divergence from the sample. Operator-promises filters ONE response
 * holding the whole roster (~136 rows), so its client-side view is complete.
 * This feed is server-paginated over ~44 000 rows, so a sub-tab can only ever
 * filter the 50 rows currently on screen. The counts these helpers produce are
 * therefore counts OF THE CURRENT PAGE, the tab strip says so, and no total is
 * displayed per tag — a "Контакт: 12" that silently meant "12 of the 44 000"
 * would be a lie the operator has no way to catch.
 */

import type { ContactTagFeedRow } from '../types'

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
 * Tab id → the `tag_code` the backend emits. `all` maps to null: it is not a
 * tag but the absence of a filter, so it also carries the rows no other tab
 * shows — a row whose code is outside the configured pair above all.
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
 */
export function resolveContactTagTab(raw: string | null): ContactTagTabId {
  return raw !== null && isContactTagTab(raw) ? raw : DEFAULT_CONTACT_TAG_TAB
}

/**
 * Rows visible on `tabId`. «Всі» returns the input array itself (same
 * reference, so a memo over it does not churn); a tag tab keeps the exact
 * `tag_code` matches, which by construction excludes any row whose code is
 * outside the configured pair.
 */
export function filterRowsByTagTab(
  rows: ContactTagFeedRow[],
  tabId: ContactTagTabId
): ContactTagFeedRow[] {
  const code = TAB_TAG_CODE[tabId]
  if (code === null) return rows
  return rows.filter((row) => row.tag_code === code)
}

/**
 * How many rows of the CURRENT PAGE each tab would show — «Всі» included, so
 * the strip's three numbers always add up to at least the page size and a
 * reader can see at a glance when some row belongs to neither tag.
 *
 * One pass over the rows rather than three `filter` calls: the page is at most
 * 500 rows, so this is not a performance argument but a correctness one — the
 * counts and `filterRowsByTagTab` must never disagree, and deriving both from
 * the same `tag_code` equality is what guarantees it.
 */
export function countRowsByTagTab(
  rows: readonly ContactTagFeedRow[]
): Record<ContactTagTabId, number> {
  const counts: Record<ContactTagTabId, number> = { all: rows.length, kontakt: 0, nekontakt: 0 }
  for (const row of rows) {
    if (row.tag_code === TAB_TAG_CODE.kontakt) counts.kontakt += 1
    else if (row.tag_code === TAB_TAG_CODE.nekontakt) counts.nekontakt += 1
  }
  return counts
}
