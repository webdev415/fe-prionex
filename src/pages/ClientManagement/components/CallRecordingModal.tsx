/**
 * Call Recording Modal Component
 *
 * Modal for playing call recordings with audio controls. Playback +
 * transport + download live in the reusable `CallPlayer`; this modal owns the
 * header (operator / date / phone), the optional trainer slots
 * (markers / feedback / scorecard), and the footer.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TelephonyTypeBadge } from '@/components/ui/TelephonyTypeBadge'
import { Icons } from '@/lib/icons'
import { useCallStore } from '@/stores/callStore'
import { CallMaterialsPanel } from '@/pages/Training/components/training/CallMaterialsPanel'
import { CallPlayer, type CallPlayerHandle } from './CallPlayer'
import { piiProps } from '@/lib/openreplay/pii'

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
   * KAN-410 — side panel rendered below the player (trainer flow). Operator-
   * side call sites leave this unset and get the legacy single-column layout.
   */
  scorecardPanel?: ReactNode
  /** KAN-410 — overlay layered on top of the scrub bar (marker timeline). */
  markerOverlay?: ReactNode
  /** KAN-410 — content rendered after the control row (Add marker / Feedback). */
  belowControls?: ReactNode
  /**
   * Call QA (Ф1) — AI transcript panel rendered below the player controls in
   * its own bounded-scroll section. A dedicated slot (rather than reusing
   * `belowControls`) so the trainer flow can combine both independently.
   */
  transcriptPanel?: ReactNode
}

/**
 * Imperative handle exposed via ``forwardRef`` (KAN-410). Delegates to the
 * embedded CallPlayer so the marker timeline can ``seekTo`` and the feedback
 * button can read ``getCurrentTimeMs``.
 */
export interface CallRecordingModalHandle {
  seekTo: (ms: number) => void
  getCurrentTimeMs: () => number
}

export const CallRecordingModal = forwardRef<CallRecordingModalHandle, CallRecordingModalProps>(
  function CallRecordingModal(
    {
      open,
      onClose,
      callData,
      onMinimize,
      scorecardPanel,
      markerOverlay,
      belowControls,
      transcriptPanel,
    },
    forwardedRef
  ) {
    const { t } = useTranslation('common')
    const { setMinimizedCall, setOpenCallModal, minimizedCall } = useCallStore()
    const playerRef = useRef<CallPlayerHandle>(null)
    const [isDownloading, setIsDownloading] = useState(false)

    // Track modal open state
    useEffect(() => {
      if (open) {
        setOpenCallModal('call-recording')
      } else {
        if (!minimizedCall || minimizedCall.type !== 'call-recording') {
          setOpenCallModal(null)
        }
        setIsDownloading(false)
      }
    }, [open, setOpenCallModal, minimizedCall])

    // Delegate the playback handle to the embedded CallPlayer.
    useImperativeHandle(
      forwardedRef,
      () => ({
        seekTo: (ms: number) => playerRef.current?.seekTo(ms),
        getCurrentTimeMs: () => playerRef.current?.getCurrentTimeMs() ?? 0,
      }),
      []
    )

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

    const handleMinimize = () => {
      setMinimizedCall({
        id: `call-recording-${Date.now()}`,
        type: 'call-recording',
        clientName: callData.clientName,
        phoneNumber: callData.phone,
        callData,
        timestamp: Date.now(),
      })
      if (onMinimize) {
        onMinimize()
      } else {
        onClose()
      }
    }

    return (
      <Modal open={open} onClose={onClose} maxWidth="xl" className="overflow-y-auto p-4 sm:p-6">
        {/* Minimize Button */}
        <button
          onClick={handleMinimize}
          className="hover:bg-muted absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors sm:top-4 sm:right-12"
          aria-label="Minimize modal"
        >
          <Icons.Remove02 size={20} className="text-foreground" strokeWidth={1.5} />
        </button>
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Audio Waveform Icon */}
          <div className="flex justify-center">
            <div className="bg-card flex h-12 w-12 items-center justify-center rounded-full sm:h-16 sm:w-16">
              <Icons.Voice size={32} className="text-foreground p-1 sm:size-10" strokeWidth={1} />
            </div>
          </div>

          {/* Title */}
          <DialogPrimitive.Title className="text-foreground self-stretch text-center text-xl leading-tight font-medium sm:text-2xl">
            {t('pages.clients.modals.callRecording.title')}
          </DialogPrimitive.Title>

          {/* Call Details */}
          <div className="flex flex-col gap-2">
            <div className="text-foreground flex items-center justify-center gap-2 self-stretch text-center text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
              <span>{callData.type}</span>
              <TelephonyTypeBadge type={callData.telephony_type} direction={callData.direction} />
            </div>
            <div className="text-foreground self-stretch text-center text-sm leading-[150%] font-light tracking-[-0.36px] sm:text-[18px]">
              {callData.clientId != null ? (
                <Link
                  to={`/dashboard/clients/${callData.clientId}`}
                  className="text-primary-700 hover:underline"
                  onClick={onClose}
                  data-openreplay-label="client-name-link"
                  {...piiProps}
                >
                  {callData.clientName}
                </Link>
              ) : (
                <span {...piiProps}>{callData.clientName}</span>
              )}{' '}
              - {formatDate(callData.date, callData.time)}
            </div>
            <div className="flex flex-col items-start gap-2 self-stretch sm:flex-row sm:gap-2">
              <div className="flex w-full flex-1 items-start gap-2 sm:w-auto">
                <span className="text-foreground text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {t('pages.clients.modals.callRecording.operator')}:{' '}
                </span>
                <span className="text-foreground flex-1 text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {callData.operator}
                </span>
              </div>
              <div className="flex w-full flex-1 items-start gap-2 sm:w-auto">
                <span className="text-foreground text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {t('pages.clients.modals.callRecording.duration')}:{' '}
                </span>
                <span className="text-foreground flex-1 text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {callData.duration}
                </span>
              </div>
              <div className="flex w-full flex-1 items-start gap-2 sm:w-auto">
                <span className="text-foreground text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {t('pages.clients.modals.callRecording.phone')}:{' '}
                </span>
                <span className="text-foreground flex-1 text-xs leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {callData.phone}
                </span>
              </div>
            </div>
          </div>

          {/* Player (audio + transport + speed), with the marker overlay. */}
          <CallPlayer
            ref={playerRef}
            callId={callData.call_id}
            active={open}
            markerOverlay={markerOverlay}
          />

          {/* Extra controls injected by the trainer flow. */}
          {belowControls}

          {/* Materials attached to this call. */}
          <CallMaterialsPanel callId={callData.call_id} />

          {/* Call QA (Ф1) — AI transcript, bounded scroll like the scorecard
            panel so a long dialogue doesn't blow up the modal height. */}
          {transcriptPanel ? (
            <div className="max-h-[45vh] overflow-y-auto">{transcriptPanel}</div>
          ) : null}

          {/* Side panel (scorecard); bounded scroll so the long
            evaluation form doesn't overflow the modal. */}
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
                  await playerRef.current?.download()
                } catch {
                  // silent fail
                } finally {
                  setIsDownloading(false)
                }
              }}
              disabled={!callData.call_id || isDownloading}
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
