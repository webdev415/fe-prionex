/**
 * CallPlayer — reusable call-recording audio player (extracted from
 * CallRecordingModal).
 *
 * Owns the recording fetch (Bearer-authenticated blob), playback, transport
 * controls (play/pause, -10s/+10s, speed), the scrub bar with an optional
 * marker overlay, and download. Exposes ``seekTo`` / ``getCurrentTimeMs`` /
 * ``download`` via ref so a marker timeline can drive playback, a feedback
 * button can read the current timestamp, and a consumer can trigger download
 * from its own button.
 *
 * Consumed by both CallRecordingModal (operator + trainer modal) and the
 * inline trainer review panel (KAN — Scorecard Review Panel redesign).
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { callService, RecordingTruncatedError } from '@/features/calls/api/callService'
import { isApiError, isNetworkError } from '@/lib/errors'

export interface CallPlayerHandle {
  seekTo: (ms: number) => void
  getCurrentTimeMs: () => number
  /** Fetch (or reuse) the recording blob and trigger a browser download. */
  download: () => Promise<void>
}

export interface CallPlayerProps {
  /** Recording id; when set, the player fetches the recording blob. */
  callId?: string
  /** Load/reset gate (e.g. the modal's open state). Defaults true. */
  active?: boolean
  /** Defer the recording download until the first Play. Use where the player is
   *  mounted without the user asking for audio (e.g. an auto-selected row). */
  lazy?: boolean
  /** Overlay rendered on top of the scrub bar (marker timeline). */
  markerOverlay?: ReactNode
  /** Whether the call has audio at all (the API's `has_recording`). `false`
   *  shows an explicit "no recording" state and never fetches — a call that
   *  never had audio is not a failure the trainer can retry away. */
  hasRecording?: boolean
  /** Emits the recording duration (ms) once metadata loads. */
  onDurationChange?: (durationMs: number) => void
  className?: string
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

type LoadErrorKind = 'truncated' | 'timeout' | 'missing' | 'generic'

const LOAD_ERROR_KEYS: Record<LoadErrorKind, string> = {
  truncated: 'pages.clients.modals.callRecording.loadTruncated',
  timeout: 'pages.clients.modals.callRecording.loadTimeout',
  missing: 'pages.clients.modals.callRecording.noRecording',
  generic: 'pages.clients.modals.callRecording.loadFailed',
}

const classifyLoadError = (error: unknown): LoadErrorKind => {
  if (error instanceof RecordingTruncatedError) return 'truncated'
  if (isNetworkError(error)) return 'timeout'
  // 404 = the call carries no recording_path. Permanent, so it must not be
  // offered as retryable.
  if (isApiError(error) && error.response?.status === 404) return 'missing'
  return 'generic'
}

const recordingExtensionFromBlob = (blob: Blob): string => {
  const m = blob.type
  if (m.includes('mpeg')) return '.mp3'
  if (m.includes('wav')) return '.wav'
  if (m.includes('ogg')) return '.ogg'
  if (m.includes('gsm')) return '.gsm'
  return '.wav'
}

export const CallPlayer = forwardRef<CallPlayerHandle, CallPlayerProps>(function CallPlayer(
  {
    callId,
    active = true,
    lazy = false,
    hasRecording = true,
    markerOverlay,
    onDurationChange,
    className,
  },
  forwardedRef
) {
  const { t } = useTranslation('common')
  const [isPlaying, setIsPlaying] = useState(false)
  const [isAudioLoading, setIsAudioLoading] = useState(!lazy)
  // Lazy players hold off the download until the trainer presses Play.
  const [requested, setRequested] = useState(!lazy)
  const [playWhenReady, setPlayWhenReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recordingBlobRef = useRef<Blob | null>(null)
  const recordingObjectUrlRef = useRef<string | null>(null)
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null)
  // The error KIND lives in state and is translated at render time — keeping
  // `t` out of the fetch effect's dependencies (react-i18next re-creates it).
  const [loadErrorKind, setLoadErrorKind] = useState<LoadErrorKind | null>(null)
  /** Download progress percent (0–100) while the blob streams; null = unknown. */
  const [downloadPct, setDownloadPct] = useState<number | null>(null)
  // Bumped by the retry button to re-run the fetch effect after a failure.
  const [retryToken, setRetryToken] = useState(0)

  useImperativeHandle(
    forwardedRef,
    () => ({
      seekTo: (ms: number) => {
        const el = audioRef.current
        if (!el) return
        const seconds = Math.max(0, ms / 1000)
        const clamped = Number.isFinite(el.duration) ? Math.min(seconds, el.duration) : seconds
        el.currentTime = clamped
        setCurrentTime(clamped)
      },
      getCurrentTimeMs: () => {
        const el = audioRef.current
        return el ? Math.floor(el.currentTime * 1000) : 0
      },
      download: async () => {
        if (!callId || !hasRecording) return
        let blob = recordingBlobRef.current
        if (!blob) {
          try {
            blob = await callService.fetchRecordingBlob(callId)
          } catch (error) {
            // Surface the failure in the player (a truncated 200 now rejects
            // instead of silently saving a cut-off file), then let the caller
            // observe the rejection too.
            setLoadErrorKind(classifyLoadError(error))
            throw error
          }
        }
        const ext = recordingExtensionFromBlob(blob)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `call-${callId}${ext}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      },
    }),
    [callId, hasRecording]
  )

  // Load recording with Bearer auth — <audio src="..."> can't send headers.
  // Async data-loading effect: setState here is intentional (loading → blob).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!active || !callId || !requested || !hasRecording) {
      if (recordingObjectUrlRef.current) {
        URL.revokeObjectURL(recordingObjectUrlRef.current)
        recordingObjectUrlRef.current = null
      }
      recordingBlobRef.current = null
      setAudioObjectUrl(null)
      // A call with no audio states so outright; the other exits are just idle.
      setLoadErrorKind(active && callId && !hasRecording ? 'missing' : null)
      setIsAudioLoading(false)
      setDownloadPct(null)
      return
    }

    // Aborts the in-flight download when the trainer switches dialogs or the
    // player unmounts — a 9 MB recording must not keep streaming for a row
    // that is no longer on screen (KAN-1030).
    const controller = new AbortController()
    let cancelled = false
    setIsAudioLoading(true)
    setLoadErrorKind(null)
    setDownloadPct(null)

    if (recordingObjectUrlRef.current) {
      URL.revokeObjectURL(recordingObjectUrlRef.current)
      recordingObjectUrlRef.current = null
    }
    setAudioObjectUrl(null)
    recordingBlobRef.current = null
    ;(async () => {
      try {
        const blob = await callService.fetchRecordingBlob(callId, {
          signal: controller.signal,
          onProgress: ({ loadedBytes, totalBytes }) => {
            if (cancelled || totalBytes == null) return
            setDownloadPct(Math.min(100, Math.round((loadedBytes / totalBytes) * 100)))
          },
        })
        if (cancelled) return
        recordingBlobRef.current = blob
        setDownloadPct(null)
        const url = URL.createObjectURL(blob)
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        recordingObjectUrlRef.current = url
        setAudioObjectUrl(url)
      } catch (error) {
        // An abort is not a failure — the effect that cancelled it owns the UI.
        if (cancelled) return
        recordingBlobRef.current = null
        setDownloadPct(null)
        // A truncated 200 (server cut the body short) must not be played as a
        // shorter call — it surfaces as an explicit, retryable error instead.
        setLoadErrorKind(classifyLoadError(error))
        setIsAudioLoading(false)
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
      if (recordingObjectUrlRef.current) {
        URL.revokeObjectURL(recordingObjectUrlRef.current)
        recordingObjectUrlRef.current = null
      }
      recordingBlobRef.current = null
      setAudioObjectUrl(null)
    }
  }, [active, callId, requested, retryToken, hasRecording])
  /* eslint-enable react-hooks/set-state-in-effect */

  // A new call re-arms the lazy gate so the next recording isn't pre-fetched.
  const [trackedCallId, setTrackedCallId] = useState(callId)
  if (callId !== trackedCallId) {
    setTrackedCallId(callId)
    setRequested(!lazy)
    setPlayWhenReady(false)
  }

  // Reset playback UI when deactivated (render-time adjustment per the React
  // docs — avoids the set-state-in-effect lint and an extra render).
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (!active) {
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setPlaybackSpeed(1.0)
      setShowSpeedMenu(false)
    }
  }

  // Re-runs the fetch effect after a failed / truncated download.
  const handleRetry = () => {
    setLoadErrorKind(null)
    setIsAudioLoading(true)
    setRetryToken((token) => token + 1)
  }

  const handlePlayPause = () => {
    // First press on a lazy player kicks off the download and plays on arrival.
    if (!requested) {
      setRequested(true)
      setPlayWhenReady(true)
      return
    }
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const handleSkipBackward = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, audio.currentTime - 10)
  }

  const handleSkipForward = () => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10)
  }

  const handleSpeedChange = (speed: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = speed
    setPlaybackSpeed(speed)
    setShowSpeedMenu(false)
  }

  const handleProgressChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * audio.duration
    audio.currentTime = Math.max(0, Math.min(audio.duration, newTime))
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0
  const loadErrorMessage = loadErrorKind ? t(LOAD_ERROR_KEYS[loadErrorKind]) : null

  return (
    <div className={cn('flex flex-col gap-4 sm:gap-6', className)}>
      {audioObjectUrl && (
        <audio
          ref={audioRef}
          key={audioObjectUrl}
          src={audioObjectUrl}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration
            if (Number.isFinite(d)) {
              setDuration(d)
              onDurationChange?.(Math.floor(d * 1000))
            }
            setIsAudioLoading(false)
          }}
          onCanPlay={(e) => {
            setIsAudioLoading(false)
            if (playWhenReady) {
              setPlayWhenReady(false)
              e.currentTarget.play()
              setIsPlaying(true)
            }
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setLoadErrorKind('generic')
            setIsAudioLoading(false)
            setIsPlaying(false)
          }}
        >
          <track kind="captions" />
        </audio>
      )}

      {/* Audio Player */}
      <div className="relative">
        {loadErrorMessage && (
          <div className="mb-2 flex flex-col items-center gap-1.5">
            <p className="text-error-600 text-center text-sm">{loadErrorMessage}</p>
            {/* Nothing to retry when the call simply has no recording. */}
            {loadErrorKind !== 'missing' && (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                data-testid="call-player-retry"
                onClick={handleRetry}
                className="h-[32px] rounded-md text-xs"
              >
                <Icons.Reload size={14} className="mr-1" />
                {t('pages.clients.modals.callRecording.retry')}
              </Button>
            )}
          </div>
        )}
        {isAudioLoading && !loadErrorMessage && (
          <div
            className="bg-card/80 absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-full"
            aria-label={t('pages.clients.modals.callRecording.downloading')}
          >
            <Icons.Spinner className="h-6 w-6" />
            {downloadPct != null && (
              <span
                data-testid="call-player-progress"
                className="text-foreground text-xs font-medium tabular-nums"
              >
                {downloadPct}%
              </span>
            )}
          </div>
        )}
        <div className="bg-card flex items-center gap-2 self-stretch rounded-full px-2 py-2 sm:gap-3 sm:px-[14px] sm:py-[15px]">
          <button
            onClick={handlePlayPause}
            disabled={isAudioLoading || !!loadErrorKind}
            className="shrink-0 cursor-pointer disabled:opacity-40"
          >
            {isPlaying ? (
              <Icons.Pause size={18} className="text-foreground sm:size-5" strokeWidth={1.5} />
            ) : (
              <Icons.PlayCircle02
                size={18}
                className="text-foreground sm:size-5"
                strokeWidth={1.5}
              />
            )}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
            <span className="text-foreground shrink-0 text-xs font-medium sm:text-sm">
              {formatTime(Math.floor(currentTime))}
            </span>
            <div
              className="bg-muted relative h-1 min-w-0 flex-1 cursor-pointer rounded-full"
              onClick={handleProgressChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleProgressChange(e as unknown as React.MouseEvent<HTMLDivElement>)
                }
              }}
              role="slider"
              tabIndex={0}
              aria-label={t('pages.clients.modals.callRecording.audioProgress')}
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
            >
              <div
                className="bg-muted-foreground h-full rounded-full transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
              {markerOverlay}
            </div>
            <span className="text-foreground shrink-0 text-xs font-medium sm:text-sm">
              {formatTime(Math.floor(duration))}
            </span>
          </div>
          <button className="text-foreground hover:text-foreground shrink-0 cursor-pointer">
            <Icons.VolumeHigh size={18} className="sm:size-5" />
          </button>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-start gap-2 self-stretch sm:gap-3">
        <Button
          variant="secondary"
          onClick={handleSkipBackward}
          disabled={isAudioLoading || !!loadErrorKind}
          className="flex h-[40px] min-w-[calc(50%-4px)] rounded-md text-xs sm:h-[45px] sm:min-w-0 sm:text-sm"
          size="sm"
        >
          <Icons.Backward02 size={14} className="mr-1 sm:size-4" />
          -10s
        </Button>
        <Button
          variant="secondary"
          onClick={handlePlayPause}
          disabled={isAudioLoading || !!loadErrorKind}
          className="flex h-[40px] min-w-[calc(50%-4px)] rounded-md text-xs sm:h-[45px] sm:min-w-0 sm:text-sm"
          size="sm"
        >
          {isPlaying ? (
            <>
              <Icons.Pause size={14} className="mr-1 sm:size-4" />
              {t('pages.clients.modals.callRecording.pause')}
            </>
          ) : (
            <>
              <Icons.PlayCircle02 size={14} className="mr-1 ml-0.5 sm:size-4" />
              {t('pages.clients.modals.callRecording.play')}
            </>
          )}
        </Button>
        <Button
          variant="secondary"
          onClick={handleSkipForward}
          disabled={isAudioLoading || !!loadErrorKind}
          className="flex h-[40px] min-w-[calc(50%-4px)] rounded-md text-xs sm:h-[45px] sm:min-w-0 sm:text-sm"
          size="sm"
        >
          <Icons.Forward02 size={14} className="mr-1 sm:size-4" />
          +10s
        </Button>
        <div className="relative min-w-[calc(50%-4px)] flex-1 sm:min-w-0">
          <Button
            variant="secondary"
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            disabled={isAudioLoading || !!loadErrorKind}
            className="flex h-[40px] w-full rounded-md text-xs sm:h-[45px] sm:text-sm"
            size="sm"
          >
            {t('pages.clients.modals.callRecording.speed')}: {playbackSpeed.toFixed(1)}x
            <Icons.ArrowDown size={14} className="ml-1 sm:size-4" />
          </Button>
          {showSpeedMenu && (
            <div className="border-border bg-card absolute top-full right-0 z-10 mt-1 rounded-md border shadow-lg">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                <button
                  key={speed}
                  onClick={() => handleSpeedChange(speed)}
                  className={cn(
                    'text-foreground hover:bg-muted w-full px-3 py-2 text-left text-xs sm:px-4 sm:text-sm',
                    playbackSpeed === speed && 'bg-primary/10 text-primary-700'
                  )}
                >
                  {speed.toFixed(1)}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default CallPlayer
