/**
 * Promises Feed Feature
 *
 * «Обіцянки» work list (client-service, migrated Metabase Card 119): the
 * row-by-row feed of promises whose PROMISED date falls inside the window —
 * who has to pay in the period, whether they were already worked today and
 * whether the promise already saw a payment. Paginated; the two
 * Techno-Finance toggles (hide worked / hide paid) filter SERVER-side.
 */

export { PromisesFeedTab } from './components/PromisesFeedTab'
export { PromisesFeedTable, PROMISES_FEED_COLUMN_COUNT } from './components/PromisesFeedTable'
export { usePromisesFeed, promisesFeedKeys, type UsePromisesFeedParams } from './hooks'
export { getPromisesFeed } from './api/promisesFeedApi'
export type { PromisesFeedParams, PromisesFeedRow, PromisesFeedResponse } from './types'
export { MAX_RANGE_DAYS, isWindowTooLong } from './utils/window'
