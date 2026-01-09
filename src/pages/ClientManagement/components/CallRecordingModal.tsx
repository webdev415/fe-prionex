/**
 * Call Recording Modal Component
 *
 * Modal for playing call recordings with audio controls.
 */

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useCallStore } from '@/stores/callStore'

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
  }
  onMinimize?: () => void
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function CallRecordingModal({
  open,
  onClose,
  callData,
  onMinimize,
}: CallRecordingModalProps) {
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
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingDuration = 83 // 1:23 in seconds (mock data)

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

  // Timer for playback
  useEffect(() => {
    if (isPlaying && open) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + playbackSpeed
          if (next >= recordingDuration) {
            setIsPlaying(false)
            return recordingDuration
          }
          return next
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, open, playbackSpeed, recordingDuration])

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      // Reset state when modal closes
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPlaying(false)
      setCurrentTime(0)
      setPlaybackSpeed(1.0)
      setShowSpeedMenu(false)
    }
  }, [open])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleSkipBackward = () => {
    setCurrentTime((prev) => Math.max(0, prev - 10))
  }

  const handleSkipForward = () => {
    setCurrentTime((prev) => Math.min(recordingDuration, prev + 10))
  }

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed)
    setShowSpeedMenu(false)
  }

  const handleProgressChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * recordingDuration
    setCurrentTime(Math.max(0, Math.min(recordingDuration, newTime)))
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

  const progressPercentage = (currentTime / recordingDuration) * 100

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl" className="p-6">
      {/* Minimize Button */}
      <button
        onClick={handleMinimize}
        className="absolute top-4 right-12 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
        aria-label="Minimize modal"
      >
        <Icons.Remove02 size={20} className="text-dark-500" strokeWidth={1.5} />
      </button>
      <div className="flex flex-col gap-6">
        {/* Audio Waveform Icon */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
            <Icons.Voice size={40} className="text-dark-500 p-1" strokeWidth={1} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-dark-500 self-stretch text-center text-2xl leading-tight font-medium">
          {t('pages.clients.modals.callRecording.title')}
        </h2>

        {/* Call Details */}
        <div className="flex flex-col gap-2">
          <div className="text-dark-500 self-stretch text-center text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
            {callData.type}
          </div>
          <div className="text-dark-500 self-stretch text-center text-[18px] leading-[150%] font-light tracking-[-0.36px]">
            {callData.clientName} - {formatDate(callData.date, callData.time)}
          </div>
          <div className="flex items-start gap-2 self-stretch">
            <div className="flex flex-1 items-start gap-2">
              <span className="text-base leading-[155%] font-light tracking-[-0.32px] text-gray-700">
                {t('pages.clients.modals.callRecording.operator')}:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-light tracking-[-0.32px]">
                {callData.operator}
              </span>
            </div>
            <div className="flex flex-1 items-start gap-2">
              <span className="text-base leading-[155%] font-light tracking-[-0.32px] text-gray-700">
                {t('pages.clients.modals.callRecording.duration')}:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-light tracking-[-0.32px]">
                {callData.duration}
              </span>
            </div>
            <div className="flex flex-1 items-start gap-2">
              <span className="text-base leading-[155%] font-light tracking-[-0.32px] text-gray-700">
                {t('pages.clients.modals.callRecording.phone')}:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-light tracking-[-0.32px]">
                {callData.phone}
              </span>
            </div>
          </div>
        </div>

        {/* Audio Player */}
        <div className="flex items-center gap-3 self-stretch rounded-full bg-white px-[14px] py-[15px]">
          <button onClick={handlePlayPause} className="cursor-pointer">
            {isPlaying ? (
              <Icons.Pause size={20} className="text-dark-500" strokeWidth={1.5} />
            ) : (
              <Icons.PlayCircle02 size={20} className="text-dark-500" strokeWidth={1.5} />
            )}
          </button>
          <div className="flex flex-1 items-center gap-2">
            <span className="text-dark-500 text-sm font-medium">
              {formatTime(Math.floor(currentTime))}
            </span>
            <div
              className="relative h-1 flex-1 cursor-pointer rounded-full bg-gray-200"
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
              aria-valuemax={recordingDuration}
              aria-valuenow={currentTime}
            >
              <div
                className="h-full rounded-full bg-gray-700 transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="text-dark-500 text-sm font-medium">
              {formatTime(recordingDuration)}
            </span>
          </div>
          <button className="text-dark-500 cursor-pointer hover:text-gray-800">
            <Icons.VolumeHigh size={20} />
          </button>
        </div>

        {/* Control Buttons */}
        <div className="flex items-start gap-3 self-stretch">
          <Button
            variant="secondary"
            onClick={handleSkipBackward}
            className="flex h-[45px] flex-1 rounded"
          >
            <Icons.Backward02 size={16} className="mr-1" />
            -10s
          </Button>
          <Button
            variant="secondary"
            onClick={handlePlayPause}
            className="flex h-[45px] flex-1 rounded"
          >
            {isPlaying ? (
              <>
                <Icons.Pause size={16} className="mr-1" />
                {t('pages.clients.modals.callRecording.pause')}
              </>
            ) : (
              <>
                <Icons.PlayCircle02 size={16} className="mr-1 ml-0.5" />
                {t('pages.clients.modals.callRecording.play')}
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={handleSkipForward}
            className="flex h-[45px] flex-1 rounded"
          >
            <Icons.Forward02 size={16} className="mr-1" />
            +10s
          </Button>
          <div className="relative">
            <Button
              variant="secondary"
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex h-[45px] flex-1 rounded"
            >
              {t('pages.clients.modals.callRecording.speed')}: {playbackSpeed.toFixed(1)}x
              <Icons.ArrowDown size={16} className="ml-1" />
            </Button>
            {showSpeedMenu && (
              <div className="absolute top-full right-0 z-10 mt-1 rounded-md border border-gray-300 bg-white shadow-lg">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSpeedChange(speed)}
                    className={cn(
                      'text-dark-500 w-full px-4 py-2 text-left text-sm hover:bg-gray-100',
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

        {/* Footer Buttons */}
        <ModalFooter>
          <Button variant="cancel" size="md" onClick={onClose} className="flex-1">
            {t('actions.close')}
          </Button>
          <Button
            variant="primary"
            size="md"
            className="flex-1"
            onClick={() => {
              // TODO: Implement download functionality
              console.log('Download recording')
            }}
          >
            <Icons.Mp301 size={20} className="mr-2" />
            {t('pages.clients.modals.callRecording.download')}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default CallRecordingModal
