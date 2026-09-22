/**
 * Drains Feed Feature
 *
 * «Зливи» broken-promise list (client-service, migrated Metabase Card 120):
 * clients who promised to pay by a day inside the window and did not. ONE ROW
 * IS ONE CLIENT — the backend resolves each client's LAST promise over the
 * whole history — so `total` counts clients, and a historical window shrinks
 * as its clients promise again.
 *
 * Paginated; the three Techno-Finance toggles (hide worked today / hide worked
 * / hide paid) filter SERVER-side. Its window defaults to the PREVIOUS WORKING
 * DAY (Monday → Friday–Sunday) and, alone on this page, can be switched off
 * entirely for the endpoint's all-history mode.
 */

export { DrainsFeedTab } from './components/DrainsFeedTab'
export { DrainsFeedTable, DRAINS_FEED_COLUMN_COUNT } from './components/DrainsFeedTable'
export { useDrainsFeed, drainsFeedKeys, type UseDrainsFeedParams } from './hooks'
export { getDrainsFeed } from './api/drainsFeedApi'
export { previousWorkingDayWindow, type DrainsDefaultWindow } from './lib/previousWorkingDayWindow'
export type { DrainsFeedParams, DrainsFeedRow, DrainsFeedResponse } from './types'
