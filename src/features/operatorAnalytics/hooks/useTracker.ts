import { useContext } from 'react'
import { TrackingContext, type Tracker } from '../providers/trackingContext'

const NOOP_TRACKER: Tracker = () => {}

/**
 * Returns the active tracker function from the surrounding `<TrackingProvider>`.
 * If no provider is mounted (e.g. outside the dashboard), a no-op is returned
 * so call sites can safely invoke it unconditionally.
 */
export function useTracker(): Tracker {
  return useContext(TrackingContext) ?? NOOP_TRACKER
}
