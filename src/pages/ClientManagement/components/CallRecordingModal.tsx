/**
 * Call Recording Modal Component
 *
 * Modal for playing call recordings with audio controls.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TelephonyTypeBadge } from '@/components/ui/TelephonyTypeBadge'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useCallStore } from '@/stores/callStore'
import { callService } from '@/features/calls/api/callService'

export interface CallRecordingModalProps {
  open: boolean
  onClose: () => void
  callData: {
    type: string
    clientName: string
    date: string
    time: string
    operator: string
    duration: string
    phone: string
    call_id?: string // Optional call ID for fetching recording
    /**
     * Optional client ID. When set, the rendered `clientName` becomes a
     * clickable link to `/dashboard/clients/{clientId}`. Used by the Action
     * Analysis Call List flow (KAN-409 follow-up); operator-side call sites
     * leave it unset and get the legacy plain-text rendering.
     */
    clientId?: number | null
    /**
     * KAN-482: telephony type ('white' | 'grey' | 'unknown') + direction
     * drive the inline White/Grey badge. Inbound calls always render `—`.
     */
    direction?: string | null
    telephony_type?: string | null
  }
  onMinimize?: () => void
  /**
   * KAN-410 — side panel rendered to the right of the player (in the trainer
   * Action Analysis flow only). Operator-side call sites leave this unset and
   * the legacy single-column layout is preserved unchanged.
   */
  scorecardPanel?: ReactNode
  /**
   * KAN-410 — absolutely-positioned overlay layered on top of the scrub bar.
   * Used by the marker timeline (colored dots + click-to-seek tooltips).
   */
  markerOverlay?: ReactNode
  /**
   * KAN-410 — additional content rendered after the control button row
   * (Add marker / Leave feedback buttons live here in the trainer flow).
   */
  belowControls?: ReactNode
}

/**
 * Imperative handle exposed via ``forwardRef`` (KAN-410).
 *
 * The marker timeline overlay calls ``seekTo(ms)`` to jump the player when
 * the trainer clicks a dot; the ``LeaveFeedbackButton`` calls
 * ``getCurrentTimeMs()`` to prefill the feedback timestamp.
 */
export interface CallRecordingModalHandle {
  seekTo: (ms: number) => void
  getCurrentTimeMs: () => number
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export const CallRecordingModal = forwardRef<CallRecordingModalHandle, CallRecordingModalProps>(
  function CallRecordingModal(
    { open, onClose, callData, onMinimize, scorecardPanel, markerOverlay, belowControls },
    forwardedRef
  ) {
    const { t } = useTranslation('common')
    const { setMinimizedCall, setOpenCallModal, minimizedCall } = useCallStore()

    // Track modal open state
    useEffect(() => {
      if (open) {
        setOpenCallModal('call-recording')
      } else {
        // Only clear openCallModal if there's no minimized call
        // This prevents clearing the state when minimizing
        if (!minimizedCall || minimizedCall.type !== 'call-recording') {
          setOpenCallModal(null)
        }
      }
    }, [open, setOpenCallModal, minimizedCall])
    const [isPlaying, setIsPlaying] = useState(false)
    const [isAudioLoading, setIsAudioLoading] = useState(true)
    const [isDownloading, setIsDownloading] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
    const [showSpeedMenu, setShowSpeedMenu] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const recordingBlobRef = useRef<Blob | null>(null)
    const recordingObjectUrlRef = useRef<string | null>(null)
    const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)

    // KAN-410 — expose seekTo + currentTimeMs to parent via forwardRef so the
    // marker timeline can drive playback and the feedback button can prefill
    // the timestamp.
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
      }),
      []
    )

    // Format date for display
    const formatDate = (dateStr: string, timeStr: string) => {
      try {
        const date = new Date(dateStr)
        const monthNames = [
          t('pages.clients.modals.callRecording.months.january'),
          t('pages.clients.modals.callRecording.months.february'),
          t('pages.clients.modals.callRecording.months.march'),
          t('pages.clients.modals.callRecording.months.april'),
          t('pages.clients.modals.callRecording.months.may'),
          t('pages.clients.modals.callRecording.months.june'),
          t('pages.clients.modals.callRecording.months.july'),
          t('pages.clients.modals.callRecording.months.august'),
          t('pages.clients.modals.callRecording.months.september'),
          t('pages.clients.modals.callRecording.months.october'),
          t('pages.clients.modals.callRecording.months.november'),
          t('pages.clients.modals.callRecording.months.december'),
        ]
        const month = monthNames[date.getMonth()]
        const day = date.getDate()
        const year = date.getFullYear()
        return `${month} ${day}, ${year} ${timeStr}`
      } catch {
        return `${dateStr} ${timeStr}`
      }
    }

    // Load recording with Bearer auth — <audio src="..."> cannot send Authorization headers.
    useEffect(() => {
      if (!open || !callData.call_id) {
        if (recordingObjectUrlRef.current) {
          URL.revokeObjectURL(recordingObjectUrlRef.current)
          recordingObjectUrlRef.current = null
        }
        recordingBlobRef.current = null
        setAudioObjectUrl(null)
        setLoadError(null)
        setIsAudioLoading(false)
        return
      }

      let cancelled = false
      const callId = callData.call_id
      setIsAudioLoading(true)
      setLoadError(null)

      if (recordingObjectUrlRef.current) {
        URL.revokeObjectURL(recordingObjectUrlRef.current)
        recordingObjectUrlRef.current = null
      }
      setAudioObjectUrl(null)
      recordingBlobRef.current = null
      ;(async () => {
        try {
          const blob = await callService.fetchRecordingBlob(callId)
          if (cancelled) return
          recordingBlobRef.current = blob
          const url = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(url)
            return
          }
          recordingObjectUrlRef.current = url
          setAudioObjectUrl(url)
        } catch {
          if (cancelled) return
          recordingBlobRef.current = null
          setLoadError(t('pages.clients.modals.callRecording.loadFailed'))
          setIsAudioLoading(false)
        }
      })()

      return () => {
        cancelled = true
        if (recordingObjectUrlRef.current) {
          URL.revokeObjectURL(recordingObjectUrlRef.current)
          recordingObjectUrlRef.current = null
        }
        recordingBlobRef.current = null
        setAudioObjectUrl(null)
      }
    }, [open, callData.call_id, t])

    // Reset playback UI when modal closes
    useEffect(() => {
      if (!open) {
        setIsPlaying(false)
        setIsDownloading(false)
        setCurrentTime(0)
        setDuration(0)
        setPlaybackSpeed(1.0)
        setShowSpeedMenu(false)
      }
    }, [open])

    const recordingExtensionFromBlob = (blob: Blob): string => {
      const m = blob.type
      if (m.includes('mpeg')) return '.mp3'
      if (m.includes('wav')) return '.wav'
      if (m.includes('ogg')) return '.ogg'
      if (m.includes('gsm')) return '.gsm'
      return '.wav'
    }

    const handlePlayPause = () => {
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

    const handleMinimize = () => {
      setMinimizedCall({
        id: `call-recording-${Date.now()}`,
        type: 'call-recording',
        clientName: callData.clientName,
        phoneNumber: callData.phone,
        callData,
        timestamp: Date.now(),
      })
      // If onMinimize is provided, use it instead of onClose
      // This prevents clearing the minimized state when restoring and re-minimizing
      if (onMinimize) {
        onMinimize()
      } else {
        onClose()
      }
    }

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
      <Modal open={open} onClose={onClose} maxWidth="xl" className="overflow-y-auto p-4 sm:p-6">
        {/* Hidden audio element for playback (blob URL from authenticated fetch) */}
        {audioObjectUrl && (
          <audio
            ref={audioRef}
            key={audioObjectUrl}
            src={audioObjectUrl}
            preload="metadata"
            className="hidden"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration
              if (Number.isFinite(d)) setDuration(d)
              setIsAudioLoading(false)
            }}
            onCanPlay={() => setIsAudioLoading(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setIsPlaying(false)}
            onError={() => {
              setLoadError(t('pages.clients.modals.callRecording.loadFailed'))
              setIsAudioLoading(false)
              setIsPlaying(false)
            }}
          >
            <track kind="captions" />
          </audio>
        )}

        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 sm:top-4 sm:right-12"
          aria-label="Minimize modal"
        >
          <Icons.Remove02 size={20} className="text-dark-500" strokeWidth={1.5} />
        </button>
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Audio Waveform Icon */}
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white sm:h-16 sm:w-16">
              <Icons.Voice size={32} className="text-dark-500 p-1 sm:size-10" strokeWidth={1} />
            </div>
          </div>

          {/* Title */}
          <DialogPrimitive.Title className="text-dark-500 self-stretch text-center text-xl leading-tight font-medium sm:text-2xl">
            {t('pages.clients.modals.callRecording.title')}
          </DialogPrimitive.Title>

          {/* Call Details */}
          <div className="flex flex-col gap-2">
            <div className="text-dark-500 flex items-center justify-center gap-2 self-stretch text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
              <span>{callData.type}</span>
              {/* KAN-482: White/Grey telephony badge. Inbound + unknown render
                as an em-dash inside the badge component. */}
              <TelephonyTypeBadge type={callData.telephony_type} direction={callData.direction} />
            </div>
            <div className="text-dark-500 self-stretch text-center text-sm leading-[150%] font-light tracking-[-0.36px] sm:text-[18px]">
              {callData.clientId != null ? (
                <Link
                  to={`/dashboard/clients/${callData.clientId}`}
                  className="text-primary-600 hover:underline"
                  onClick={onClose}
                >
                  {callData.clientName}
                </Link>
              ) : (
                callData.clientName
              )}{' '}
              - {formatDate(callData.date, callData.time)}
            </div>
            <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:gap-2">
              <div className="flex w-full flex-1 items-start gap-2 sm:w-auto">
                <span className="text-xs leading-[155%] font-light tracking-[-0.32px] text-gray-700 sm:text-base">
                  {t('pages.clients.modals.callRecording.operator')}:{' '}
                </span>
                <span className="text-dark-500 flex-1 text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {callData.operator}
                </span>
              </div>
              <div className="flex w-full flex-1 items-start gap-2 sm:w-auto">
                <span className="text-xs leading-[155%] font-light tracking-[-0.32px] text-gray-700 sm:text-base">
                  {t('pages.clients.modals.callRecording.duration')}:{' '}
                </span>
                <span className="text-dark-500 flex-1 text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {callData.duration}
                </span>
              </div>
              <div className="flex w-full flex-1 items-start gap-2 sm:w-auto">
                <span className="text-xs leading-[155%] font-light tracking-[-0.32px] text-gray-700 sm:text-base">
                  {t('pages.clients.modals.callRecording.phone')}:{' '}
                </span>
                <span className="text-dark-500 flex-1 text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {callData.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Audio Player */}
          <div className="relative">
            {loadError && <p className="text-error-600 mb-2 text-center text-sm">{loadError}</p>}
            {isAudioLoading && !loadError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-full bg-white/80">
                <Icons.Spinner className="h-6 w-6" />
              </div>
            )}
            <div className="flex items-center gap-2 self-stretch rounded-full bg-white px-2 py-2 sm:gap-3 sm:px-[14px] sm:py-[15px]">
              <button
                onClick={handlePlayPause}
                disabled={isAudioLoading || !!loadError}
                className="shrink-0 cursor-pointer disabled:opacity-40"
              >
                {isPlaying ? (
                  <Icons.Pause size={18} className="text-dark-500 sm:size-5" strokeWidth={1.5} />
                ) : (
                  <Icons.PlayCircle02
                    size={18}
                    className="text-dark-500 sm:size-5"
                    strokeWidth={1.5}
                  />
                )}
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <span className="text-dark-500 shrink-0 text-xs font-medium sm:text-sm">
                  {formatTime(Math.floor(currentTime))}
                </span>
                <div
                  className="relative h-1 min-w-0 flex-1 cursor-pointer rounded-full bg-gray-200"
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
                    className="h-full rounded-full bg-gray-700 transition-all"
                    style={{ width: `${progressPercentage}%` }}
                  />
                  {/* KAN-410 — marker timeline overlay. The overlay component
                    positions itself absolutely against this scrub div and
                    consumes the parent-passed ref to drive seekTo. */}
                  {markerOverlay}
                </div>
                <span className="text-dark-500 shrink-0 text-xs font-medium sm:text-sm">
                  {formatTime(Math.floor(duration))}
                </span>
              </div>
              <button className="text-dark-500 shrink-0 cursor-pointer hover:text-gray-800">
                <Icons.VolumeHigh size={18} className="sm:size-5" />
              </button>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap items-start gap-2 self-stretch sm:gap-3">
            <Button
              variant="secondary"
              onClick={handleSkipBackward}
              disabled={isAudioLoading || !!loadError}
              className="flex h-[40px] min-w-[calc(50%-4px)] rounded-md text-xs sm:h-[45px] sm:min-w-0 sm:text-sm"
              size="sm"
            >
              <Icons.Backward02 size={14} className="mr-1 sm:size-4" />
              -10s
            </Button>
            <Button
              variant="secondary"
              onClick={handlePlayPause}
              disabled={isAudioLoading || !!loadError}
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
              disabled={isAudioLoading || !!loadError}
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
                disabled={isAudioLoading || !!loadError}
                className="flex h-[40px] w-full rounded-md text-xs sm:h-[45px] sm:text-sm"
                size="sm"
              >
                {t('pages.clients.modals.callRecording.speed')}: {playbackSpeed.toFixed(1)}x
                <Icons.ArrowDown size={14} className="ml-1 sm:size-4" />
              </Button>
              {showSpeedMenu && (
                <div className="absolute top-full right-0 z-10 mt-1 rounded-md border border-gray-300 bg-white shadow-lg">
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={cn(
                        'text-dark-500 w-full px-3 py-2 text-left text-xs hover:bg-gray-100 sm:px-4 sm:text-sm',
                        playbackSpeed === speed && 'bg-primary-100 text-primary-700'
                      )}
                    >
                      {speed.toFixed(1)}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* KAN-410 — extra controls injected by the trainer flow
            (Add marker / Leave feedback). */}
          {belowControls}

          {/* KAN-410 — side panel (scorecard) shipped by the trainer flow.
            Bounded scroll area so the long evaluation form doesn't overflow
            the modal — the audio player + marker/feedback controls above stay
            visible while the criteria list scrolls within. */}
          {scorecardPanel ? (
            <div className="max-h-[50vh] min-h-[180px] overflow-y-auto">{scorecardPanel}</div>
          ) : null}

          {/* Footer Buttons */}
          <ModalFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
            <Button variant="cancel" size="sm" onClick={onClose} className="w-full rounded-md">
              {t('actions.close')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="w-full rounded-md"
              onClick={async () => {
                if (!callData.call_id || isDownloading) return
                setIsDownloading(true)
                try {
                  let blob = recordingBlobRef.current
                  if (!blob) {
                    blob = await callService.fetchRecordingBlob(callData.call_id)
                  }
                  const ext = recordingExtensionFromBlob(blob)
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `call-${callData.call_id}${ext}`
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                  URL.revokeObjectURL(url)
                } catch {
                  // silent fail
                } finally {
                  setIsDownloading(false)
                }
              }}
              disabled={!callData.call_id || isDownloading || !!loadError}
              leftIcon={
                isDownloading ? (
                  <Icons.Spinner className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                ) : (
                  <Icons.Mp301 size={18} className="sm:size-5" />
                )
              }
            >
              {t('pages.clients.modals.callRecording.download')}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    )
  }
)

export default CallRecordingModal
