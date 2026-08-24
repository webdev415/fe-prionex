/**
 * Searcher Follow-up Feed Feature
 *
 * «Серчер без відпрацювання» work list (client-service, migrated Metabase
 * Card 123): clients whose latest meaningful interaction is a searcher chain
 * step that ended with «Інформація знайдена» and whom nobody has worked
 * since, one row per CLIENT — the operator's to-do list for acting on the
 * searcher's finds.
 */

export { SearcherFollowupFeedTab } from './components/SearcherFollowupFeedTab'
export {
  SearcherFollowupTable,
  SEARCHER_FOLLOWUP_COLUMN_COUNT,
} from './components/SearcherFollowupTable'
export {
  useSearcherFollowupFeed,
  searcherFollowupFeedKeys,
  type UseSearcherFollowupFeedParams,
} from './hooks'
export { getSearcherFollowupFeed } from './api/searcherFollowupFeedApi'
export type {
  SearcherFollowupFeedParams,
  SearcherFollowupRow,
  SearcherFollowupResponse,
} from './types'
export { resolveCallOutcomeDisplay, type CallOutcomeDisplay } from './utils/callOutcome'
