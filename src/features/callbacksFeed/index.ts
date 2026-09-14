/**
 * Callbacks Feed Feature
 *
 * «Перезвони» call plan (client-service, migrated Metabase Card 121): the
 * row-by-row feed of callbacks whose SCHEDULED call time falls inside the
 * window — whom to ring, at what time, who promised it and whether the client
 * has already been worked. Paginated; the two Techno-Finance toggles (hide
 * called today / hide worked) filter SERVER-side. The only feed of its family
 * without money columns.
 */

export { CallbacksFeedTab } from './components/CallbacksFeedTab'
export { CallbacksFeedTable, CALLBACKS_FEED_COLUMN_COUNT } from './components/CallbacksFeedTable'
export { useCallbacksFeed, callbacksFeedKeys, type UseCallbacksFeedParams } from './hooks'
export { getCallbacksFeed } from './api/callbacksFeedApi'
export type { CallbacksFeedParams, CallbacksFeedRow, CallbacksFeedResponse } from './types'
