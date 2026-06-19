import { useMemo, useRef, useState } from 'react'
import {
  CallRecordingModal,
  type CallRecordingModalHandle,
  type CallRecordingModalProps,
} from '@/pages/ClientManagement/components/CallRecordingModal'
import {
  AddMarkerButton,
  LeaveFeedbackButton,
  MarkerOverlay,
  ScorecardPanel,
} from '@/features/quality'
import { useMarkersForCall } from '@/features/quality/hooks/useMarkers'

/**
 * CallReviewLayout — trainer-side wrapper around CallRecordingModal that
 * fills in the KAN-410 slot props (`scorecardPanel`, `markerOverlay`,
 * `belowControls`) so a trainer sees the scorecard, markers, and feedback
 * affordances all at once.
 *
 * Mounted by trainer entry points (Quick-Action "Rate dialogue",
 * OperatorDetailPanel "Listen to the call" / "Rate dialogue"). Operator-side
 * call sites continue to use CallRecordingModal directly with no slot props
 * and get the legacy layout unchanged.
 *
 * Closes the KAN-410 deferred wiring listed in the History.md tail.
 */
export interface CallReviewLayoutProps {
  open: boolean
  onClose: () => void
  callId: string
  operatorId: number
  callData: CallRecordingModalProps['callData']
  /** Parsed duration in milliseconds; used to position marker dots. */
  durationMs?: number
}

function parseDurationMs(input: string | undefined): number {
  if (!input) return 0
  const [minsRaw, secsRaw] = input.split(':')
  const mins = Number.parseInt(minsRaw ?? '0', 10) || 0
  const secs = Number.parseInt(secsRaw ?? '0', 10) || 0
  return (mins * 60 + secs) * 1000
}

export function CallReviewLayout({
  open,
  onClose,
  callId,
  operatorId,
  callData,
  durationMs: explicitDurationMs,
}: CallReviewLayoutProps) {
  const modalRef = useRef<CallRecordingModalHandle>(null)
  const [scorecardSent, setScorecardSent] = useState(false)

  const durationMs = explicitDurationMs ?? parseDurationMs(callData?.duration)

  const markersQuery = useMarkersForCall(callId, open)
  const markers = markersQuery.data ?? []

  const seekTo = (ms: number) => modalRef.current?.seekTo(ms)
  const getCurrentTimeMs = () => modalRef.current?.getCurrentTimeMs() ?? 0

  const scorecardPanel = useMemo(
    () => (
      <ScorecardPanel
        callId={callId}
        operatorId={operatorId}
        onSent={() => setScorecardSent(true)}
      />
    ),
    [callId, operatorId]
  )

  const markerOverlay = <MarkerOverlay markers={markers} durationMs={durationMs} onSeek={seekTo} />

  const belowControls = (
    <div className="flex flex-wrap items-center gap-2">
      <AddMarkerButton
        callId={callId}
        operatorId={operatorId}
        getCurrentTimeMs={getCurrentTimeMs}
        onCreated={() => markersQuery.refetch()}
      />
      <LeaveFeedbackButton
        callId={callId}
        operatorId={operatorId}
        getCurrentTimeMs={getCurrentTimeMs}
      />
      {scorecardSent ? <span className="text-primary-600 text-xs font-medium">●</span> : null}
    </div>
  )

  return (
    <CallRecordingModal
      ref={modalRef}
      open={open}
      onClose={onClose}
      callData={callData}
      scorecardPanel={scorecardPanel}
      markerOverlay={markerOverlay}
      belowControls={belowControls}
    />
  )
}

export default CallReviewLayout
