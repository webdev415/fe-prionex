/**
 * MarkerOverlay — colored dots layered on top of the call player scrub bar (KAN-410, Feature 2.2).
 *
 * Positions each marker as `marker.timestamp_ms / duration_ms` along the
 * track. Click → calls the parent's `playerRef.seekTo(ms)` via the
 * `onSeek` callback. Hover shows the marker type + comment via the existing
 * Tooltip primitive.
 *
 * The component renders absolutely positioned children inside the modal's
 * scrub-bar div; the parent passes `durationMs` so positioning math is
 * deterministic regardless of whether audio metadata has loaded yet.
 */
import { MARKER_COLORS, type CallMarker } from '../types'

interface MarkerOverlayProps {
  markers: CallMarker[]
  durationMs: number
  onSeek: (ms: number) => void
}

export function MarkerOverlay({ markers, durationMs, onSeek }: MarkerOverlayProps) {
  if (!markers.length || durationMs <= 0) return null

  return (
    <div className="pointer-events-none absolute inset-0">
      {markers.map((marker) => {
        const pct = Math.max(0, Math.min(100, (marker.timestamp_ms / durationMs) * 100))
        const label = marker.marker_type.replace(/_/g, ' ')
        const tooltip = marker.comment ? `${label} — ${marker.comment}` : label
        return (
          <button
            key={marker.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSeek(marker.timestamp_ms)
            }}
            title={tooltip}
            className="pointer-events-auto absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{
              left: `${pct}%`,
              backgroundColor: MARKER_COLORS[marker.marker_type],
            }}
            aria-label={`Marker: ${label}`}
          />
        )
      })}
    </div>
  )
}
