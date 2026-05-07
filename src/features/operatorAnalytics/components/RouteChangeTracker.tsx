import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTrackEvent } from '../hooks/useTrackEvent'

/**
 * Emits a `route_change` tracking event whenever react-router transitions
 * to a new pathname. Mount once inside `<TrackingProvider>`.
 */
export function RouteChangeTracker() {
  const location = useLocation()
  const trackEvent = useTrackEvent()

  useEffect(() => {
    trackEvent('route_change', { pageRef: location.pathname })
  }, [location.pathname, trackEvent])

  return null
}
