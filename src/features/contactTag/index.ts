/**
 * Contact-Tag Feed Feature
 *
 * «Контакт/Неконтакт» work list (client-service, migrated Metabase Card 124):
 * clients with a live debt who carry the «Контакт» or «Неконтакт» tag and whom
 * nobody has touched — neither an interaction nor a re-assignment — for longer
 * than that tag's threshold, and who have no live promise. One row per CLIENT.
 */

export { ContactTagFeedTab } from './components/ContactTagFeedTab'
export { ContactTagTable, CONTACT_TAG_COLUMN_COUNT } from './components/ContactTagTable'
export { useContactTagFeed, contactTagFeedKeys, type UseContactTagFeedParams } from './hooks'
export { getContactTagFeed } from './api/contactTagFeedApi'
export {
  readSellToState,
  sellToRequestParam,
  type SellToMode,
  type SellToState,
} from './utils/sellWindow'
export {
  CONTACT_TAG_TAB_IDS,
  DEFAULT_CONTACT_TAG_TAB,
  countRowsByTagTab,
  filterRowsByTagTab,
  isContactTagTab,
  resolveContactTagTab,
  type ContactTagTabId,
} from './utils/tagTabs'
export type { ContactTagFeedParams, ContactTagFeedRow, ContactTagFeedResponse } from './types'
