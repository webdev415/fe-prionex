import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { formatDateTime } from '@/lib/localeFormat'
import type { DebtDetail } from '@/features/clients/api/types'
import {
  AddMarkerButton,
  CallTranscriptPanel,
  LeaveFeedbackButton,
  MarkerOverlay,
  ScorecardPanel,
} from '@/features/quality'
import { useMarkersForCall } from '@/features/quality/hooks/useMarkers'
import { CallPlayer, type CallPlayerHandle } from '@/pages/ClientManagement/components/CallPlayer'
import { CreateCorrectionTaskDialog } from '../inbox/CreateCorrectionTaskDialog'
import { LoanLink } from './LoanLink'
import { Pii, piiProps } from '@/lib/openreplay/pii'

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
  /** Whether the trainer may create/edit/send/remove here (operator assigned). */
  canEdit?: boolean
  /** Known talk time, used to position markers before the audio is fetched. */
  talkDurationSec?: number | null
  /** Whether the call has a recording. Passed through so the player states
   *  "no recording" instead of offering Play for audio that does not exist. */
  hasRecording?: boolean
  /** The call's client — shown in the header with the loan-number link
   *  («Навчання» п.8). Absent → the client line is simply not rendered. */
  clientId?: number | null
  /** Resolved client display name (falls back to `#id`). */
  clientName?: string
  /** The client's loans, for the header loan-number link. */
  clientDebts?: DebtDetail[]
  /** Emits the editor's unsaved-changes state so the tab can guard row switches. */
  onDirtyChange?: (dirty: boolean) => void
}

export function CallReviewPanel({
  callId,
  operatorId,
  operatorName,
  createdAt,
  scorecardId,
  canEdit = false,
  talkDurationSec,
  hasRecording,
  clientId,
  clientName,
  clientDebts,
  onDirtyChange,
}: CallReviewPanelProps) {
  const { t, i18n } = useTranslation('common')
  const playerRef = useRef<CallPlayerHandle>(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [durationMs, setDurationMs] = useState(0)
  // Expanded by default — the AI review is the point of opening a dialog now;
  // trainers can fold it away when they only want the scorecard.
  const [transcriptOpen, setTranscriptOpen] = useState(true)

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
          <p className="truncate text-sm font-semibold text-[#05040D]" {...piiProps}>
            {operatorName ?? `#${operatorId}`}
          </p>
          {createdAt ? (
            <p className="text-[11px] text-[#6B7280]">{formatDateTime(createdAt, i18n.language)}</p>
          ) : null}
          {clientId != null ? (
            <p
              className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#6B7280]"
              data-testid="review-client-line"
            >
              <span>{t('pages.training.dialogue.list.client', 'Client')}:</span>
              <Link
                to={`/dashboard/clients/${clientId}`}
                className="font-medium text-[#204E4D] hover:underline"
              >
                <Pii>{clientName ?? `#${clientId}`}</Pii>
              </Link>
              <LoanLink clientId={clientId} debts={clientDebts} />
            </p>
          ) : null}
        </div>

        <CallPlayer
          ref={playerRef}
          callId={callId}
          active
          lazy
          hasRecording={hasRecording}
          onDurationChange={setDurationMs}
          markerOverlay={
            <MarkerOverlay
              markers={markers}
              durationMs={durationMs || (talkDurationSec ?? 0) * 1000}
              onSeek={seekTo}
            />
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

      {/* Scrolling scorecard editor (its own header / score / save controls),
        with the AI transcript + review card underneath. */}
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#EBECE8] p-3">
        <ScorecardPanel
          key={scorecardId ?? callId}
          callId={callId}
          operatorId={operatorId}
          scorecardId={scorecardId}
          canEdit={canEdit}
          onDirtyChange={onDirtyChange}
        />

        {/* Call QA card. CallTranscriptPanel carries its own gates
          (`view_transcripts` + the global `transcripts_enabled` switch) and
          renders nothing when either is off — no checks duplicated here. */}
        <div className="mt-3 border-t border-[#EBECE8] pt-3">
          <button
            type="button"
            onClick={() => setTranscriptOpen((open) => !open)}
            aria-expanded={transcriptOpen}
            data-testid="call-review-transcript-toggle"
            className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            <span>
              {t('pages.training.dialogue.detail.transcript', 'Transcript and AI review')}
            </span>
            <Icons.ArrowDown
              size={14}
              className={
                transcriptOpen ? 'rotate-180 transition-transform' : 'transition-transform'
              }
            />
          </button>
          {transcriptOpen ? (
            <CallTranscriptPanel callId={callId} active onSeek={seekTo} className="mt-2" />
          ) : null}
        </div>
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
