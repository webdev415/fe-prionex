/**
 * Call Recording Modal Component
 *
 * Modal for playing call recordings with audio controls.
 */

import { useState, useRef, useEffect } from 'react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

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
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function CallRecordingModal({ open, onClose, callData }: CallRecordingModalProps) {
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
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
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

  const progressPercentage = (currentTime / recordingDuration) * 100

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl" className="p-6">
      <div className="flex flex-col gap-6">
        {/* Audio Waveform Icon */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
            <Icons.Voice size={40} className="text-dark-500 p-1" strokeWidth={1} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-dark-500 self-stretch text-center text-2xl leading-tight font-medium">
          Call Recording
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
                Operator:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-light tracking-[-0.32px]">
                {callData.operator}
              </span>
            </div>
            <div className="flex flex-1 items-start gap-2">
              <span className="text-base leading-[155%] font-light tracking-[-0.32px] text-gray-700">
                Duration:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-light tracking-[-0.32px]">
                {callData.duration}
              </span>
            </div>
            <div className="flex flex-1 items-start gap-2">
              <span className="text-base leading-[155%] font-light tracking-[-0.32px] text-gray-700">
                Phone:{' '}
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
              aria-label="Audio progress"
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
            variant="outline"
            onClick={handleSkipBackward}
            className="bg-secondary-800 flex h-[45px] flex-1 items-center justify-center gap-2.5 rounded border-none px-4 py-2.5 text-white"
          >
            <Icons.Backward02 size={16} className="mr-1" />
            -10s
          </Button>
          <Button
            variant="outline"
            onClick={handlePlayPause}
            className="bg-secondary-800 flex h-[45px] flex-1 items-center justify-center gap-2.5 rounded border-none px-4 py-2.5 text-white"
          >
            {isPlaying ? (
              <>
                <Icons.Pause size={16} className="mr-1" />
                Pause
              </>
            ) : (
              <>
                <Icons.PlayCircle02 size={16} className="mr-1 ml-0.5" />
                Play
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleSkipForward}
            className="bg-secondary-800 flex h-[45px] flex-1 items-center justify-center gap-2.5 rounded border-none px-4 py-2.5 text-white"
          >
            <Icons.Forward02 size={16} className="mr-1" />
            +10s
          </Button>
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="bg-secondary-800 flex h-[45px] flex-1 items-center justify-center gap-2.5 rounded border-none px-4 py-2.5 text-white"
            >
              Speed: {playbackSpeed.toFixed(1)}x
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
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="text-dark-500 border-gray-400 bg-white hover:bg-gray-50"
          >
            Close
          </Button>
          <Button
            variant="primary"
            size="md"
            className="bg-primary-300 text-dark-500 hover:bg-primary-400"
            onClick={() => {
              // TODO: Implement download functionality
              console.log('Download recording')
            }}
          >
            <Icons.Mp301 size={20} className="mr-2" />
            Download
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

export default CallRecordingModal
