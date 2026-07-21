import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  AddMarkerButton,
  LeaveFeedbackButton,
  MarkerOverlay,
  ScorecardPanel,
} from '@/features/quality'
import { useMarkersForCall } from '@/features/quality/hooks/useMarkers'
import { CallPlayer, type CallPlayerHandle } from '@/pages/ClientManagement/components/CallPlayer'
import { CreateCorrectionTaskDialog } from '../inbox/CreateCorrectionTaskDialog'

/**
 * Inline trainer review panel (Scorecard Review Panel redesign) — the right
 * column of the Dialogue Evaluation tab, replacing the read-only
 * ScorecardDetailPanel.
 *
 * Composes everything for reviewing one scorecarded call: the call player
 * (CallPlayer), the marker timeline, Add marker / Leave feedback / Assign
 * task, and the scorecard editor (ScorecardPanel — type selector + 6-level
 * criteria + script stages + explicit save / edit-lock).
 */
export interface CallReviewPanelProps {
  /** The call to review. Undefined → empty state. */
  callId?: string
  /** Operator whose call this is. Undefined → empty state. */
  operatorId?: number
  /** Resolved operator display name for the header. */
  operatorName?: string
  /** Header timestamp (call date or scorecard created_at); optional. */
  createdAt?: string
  /** Pin a specific scorecard; when absent the editor opens the latest draft on
   *  the call or lets the trainer start a new evaluation (call-first flow). */
  scorecardId?: number
  /** Emits the editor's unsaved-changes state so the tab can guard row switches. */
  onDirtyChange?: (dirty: boolean) => void
}

export function CallReviewPanel({
  callId,
  operatorId,
  operatorName,
  createdAt,
  scorecardId,
  onDirtyChange,
}: CallReviewPanelProps) {
  const { t } = useTranslation('common')
  const playerRef = useRef<CallPlayerHandle>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [durationMs, setDurationMs] = useState(0)

  const markersQuery = useMarkersForCall(callId ?? null, !!callId)
  const markers = markersQuery.data ?? []

  const seekTo = (ms: number) => playerRef.current?.seekTo(ms)
  const getCurrentTimeMs = () => playerRef.current?.getCurrentTimeMs() ?? 0

  if (callId == null || operatorId == null) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-[#6B7280] shadow-sm">
        {t('pages.training.dialogue.detail.empty', 'Select a dialog to review')}
      </div>
    )
  }

  return (
    <div className="flex max-h-[82vh] flex-col rounded-xl border border-[#EBECE8] bg-white">
      {/* Fixed top — header + player + actions. Kept out of the scroll
        container so the marker / feedback popovers aren't clipped. */}
      <div className="flex flex-col gap-3 p-4">
        <div className="border-b border-[#EBECE8] pb-3">
          <p className="truncate text-sm font-semibold text-[#05040D]">
            {operatorName ?? `#${operatorId}`}
          </p>
          {createdAt ? (
            <p className="text-[11px] text-[#6B7280]">{new Date(createdAt).toLocaleString()}</p>
          ) : null}
        </div>

        <CallPlayer
          ref={playerRef}
          callId={callId}
          active
          onDurationChange={setDurationMs}
          markerOverlay={
            <MarkerOverlay markers={markers} durationMs={durationMs} onSeek={seekTo} />
          }
        />

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
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="text-dark-500 inline-flex h-[40px] items-center gap-1.5 rounded-md border border-[#EDEDED] bg-white px-3 text-xs font-medium hover:bg-[#F7F7F7] sm:h-[45px] sm:text-sm"
          >
            <Icons.Add size={14} />
            {t('pages.training.dialogue.detail.assignTask', 'Assign task')}
          </button>
        </div>
      </div>

      {/* Scrolling scorecard editor (its own header / score / save controls). */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#EBECE8] p-3">
        <ScorecardPanel
          key={scorecardId ?? callId}
          callId={callId}
          operatorId={operatorId}
          scorecardId={scorecardId}
          onDirtyChange={onDirtyChange}
        />
      </div>

      <CreateCorrectionTaskDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        operatorId={operatorId}
        callId={callId}
      />
    </div>
  )
}

export default CallReviewPanel
