/**
 * A call's elapsed time as the operator reads it: mm:ss, or h:mm:ss once it
 * passes an hour.
 *
 * Shared rather than local to a component: the ringing timer, the connected
 * timer and the minimised pill all show the same clock, and three copies would
 * drift the moment one of them starts handling long calls.
 */
export function formatCallDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(secs).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
