/**
 * Contact-Tag Feed API
 *
 * API calls to the client-service contact-tag feed endpoint.
 * Uses the main api client (goes through Kong on port 8000).
 */

import api from '@/lib/api'
import type { ContactTagFeedParams, ContactTagFeedResponse } from './types'

const CONTACT_TAG_FEED_URL = '/api/v1/clients/reports/feeds/contact-tag'

/**
 * Get the «Контакт/Неконтакт» client work list (one row per client carrying a
 * live «Контакт»/«Неконтакт» tag whom nobody has touched — neither an
 * interaction nor a re-assignment — for longer than that tag's threshold).
 *
 * The params object is forwarded to axios VERBATIM, which is what makes the
 * three-state `sell_to` work: axios drops `null`/`undefined` values and keeps
 * empty strings, so an omitted key serialises as an absent parameter (the
 * backend applies its month−4 default) while `sell_to: ''` serialises as
 * `sell_to=` (the upper bound is switched off). Building that distinction is
 * the caller's job (`utils/sellWindow.ts`); preserving it is this module's.
 *
 * The optional `tag_code` rides the same rule: a sub-tab sends its code, «Всі»
 * omits the key, and the backend narrows the feed BEFORE paginating — so the
 * `total`/`total_pages` in the answer belong to the population that was asked
 * for. Which tab may be asked for is `utils/tagTabs.ts`.
 */
export async function getContactTagFeed(
  params: ContactTagFeedParams
): Promise<ContactTagFeedResponse> {
  const response = await api.get<ContactTagFeedResponse>(CONTACT_TAG_FEED_URL, {
    params,
  })
  return response.data
}
