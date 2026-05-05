import { useTracker } from '../providers/TrackingProvider'

export function useTrackEvent() {
  return useTracker()
}
