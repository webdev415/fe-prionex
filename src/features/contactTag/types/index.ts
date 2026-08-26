/**
 * Contact-Tag Feed Types
 *
 * UI-level types for the «Контакт/Неконтакт» feed tab, and the ONE import path
 * everything outside `api/` uses for them: components, hooks, utils and their
 * tests import from `../types`, and only the modules inside `api/` reach for
 * `./types` directly. Two spellings of the same import inside one feature is a
 * split that costs nothing to keep and quietly grows: the day a type needs a
 * UI-side widening, half the feature would keep reading the raw wire shape.
 */

export type { ContactTagFeedParams, ContactTagFeedRow, ContactTagFeedResponse } from '../api/types'
