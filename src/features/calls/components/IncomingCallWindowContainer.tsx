import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import {
  useInteractionContactTypes,
  useInteractionResults,
  useInteractionSubtypes,
  useInteractionTypes,
  useCreateBulkInteraction,
} from '@/features/clients/hooks/useNoteInteraction'
import {
  useAnswerCall,
  useCallDetails,
  useHangupCall,
  useHoldCall,
  useRejectCall,
} from '../hooks/useCall'
import { extensionOf } from '../hooks/useIncomingCall'
import { useIncludedClients } from '../hooks/useIncludedClients'
import { useCallStore } from '@/stores/callStore'
import { buildMatchedClients } from '../utils/callWindow'
import { hasUnfiledWriteUp } from '../utils/writeUp'
import { CallOutcome } from '../types'
import type { IncomingCallData } from '../types'
import { IncomingCallWindow } from './IncomingCallWindow'
import type { CallInteractionDraft, CallInteractionDraftState } from './CallInteractionForm'
import type { CallPhase } from './CallActions'

/**
 * Whether this deployment can answer a call from the CRM.
 *
 * Answering redirects the caller into an Asterisk dialplan context that not
 * every deployment has, and the call-service refuses the request until its own
 * flag is set. Mirrored here so the button is absent rather than present and
 * failing — an operator shown a control that errors reports a broken feature,
 * and meanwhile does not pick up the handset.
 */
function answerFromCrmEnabled(): boolean {
  return import.meta.env.VITE_CALL_ANSWER_ENABLED === 'true'
}

interface IncomingCallWindowContainerProps {
  incomingCall: IncomingCallData
  /** When this operator took the call, or null while it is still ringing. */
  answeredAt: number | null
  /** Called when Accept succeeds: the answer is known here before any event. */
  onAnswered: () => void
  agentExtension: string | null
  /** The header owns the minimised bar, so the window simply stands down. */
  minimized: boolean
  onMinimize: () => void
  /**
   * The line is down, but the window stays up so an interaction written during
   * the call can still be filed. Nothing here may hang up any more.
   */
  ended?: boolean
  /**
   * Whether this window is holding a write-up that has not been filed. Reported
   * upward because the window is remounted per call, so only the parent is
   * still around to say anything once the next one replaces it.
   */
  onUnsavedChange?: (callId: string, unfiled: boolean) => void
  /** Called once the call is over from this operator's point of view. */
  onDismiss: () => void
}

const asOptions = (rows?: { id: number; name: string }[]) =>
  (rows ?? []).map((row) => ({ id: row.id, name: row.name }))

/**
 * Owns the state the call window works on: which clients receive the
 * interaction, whether one has been filed, and the call actions.
 *
 * Kept apart from the window itself so the presentation can be rendered from
 * fixtures, and so the four states are testable without the query stack.
 */
export function IncomingCallWindowContainer({
  incomingCall,
  answeredAt,
  onAnswered,
  agentExtension,
  minimized,
  onMinimize,
  ended = false,
  onUnsavedChange,
  onDismiss,
}: IncomingCallWindowContainerProps) {
  const { t } = useTranslation('common')
  const clients = useMemo(() => buildMatchedClients(incomingCall), [incomingCall])
  const { isIncluded, setIncluded, includedClientIds } = useIncludedClients(clients)
  const [interactionSaved, setInteractionSaved] = useState(false)
  // The caller is parked. Tracked here because nothing on the wire reports it
  // back: without it Hold could only ever be pressed again, re-parking a caller
  // the operator was trying to retrieve.
  const [held, setHeld] = useState(false)
  // Read per render rather than once at module load: the value is still
  // substituted at build time, but a constant frozen on import cannot be
  // exercised by a test.
  const answerEnabled = answerFromCrmEnabled()
  // Held here rather than inside the form: minimising unmounts the window, and
  // a comment written while the caller is on the line cannot be recovered.
  const [draft, setDraft] = useState<Partial<CallInteractionDraftState>>({})
  // The operator ended the call from this window. Tracked separately from the
  // `ended` prop, which reports the caller ringing off: both have to leave the
  // window standing, because the draft lives here and ending a call before
  // writing it up is ordinary rather than exceptional.
  const [endedByOperator, setEndedByOperator] = useState(false)

  // Registered for as long as the window is up, so `isCallActive()` is true
  // during an inbound call and the click-to-call guard on the client pages
  // stops an operator dialling out mid-conversation. useCanShowIncomingPopup
  // is written expecting this registration and decides during render, before
  // this effect runs, so the popup still cannot suppress itself.
  useEffect(() => {
    useCallStore.getState().setOpenCallModal('call-dialog')
    return () => {
      // A minimised call window has taken over; that one is not ours to clear.
      const store = useCallStore.getState()
      if (!store.minimizedCall) store.setOpenCallModal(null)
    }
  }, [])

  const hasUnsavedWriteUp = hasUnfiledWriteUp(draft, interactionSaved)
  useEffect(() => {
    // Named, so the report cannot be mistaken for the next call's answer.
    onUnsavedChange?.(incomingCall.call_id, hasUnsavedWriteUp)
  }, [incomingCall.call_id, hasUnsavedWriteUp, onUnsavedChange])

  const isEnded = ended || endedByOperator
  const phase: CallPhase = answeredAt === null ? 'ringing' : 'connected'
  // Ticks the conversation clock. Derived from the answer time rather than
  // counted up, so a re-render or a minimise-and-restore cannot drift it.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (answeredAt === null || isEnded) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [answeredAt, isEnded])
  const durationSeconds = answeredAt === null ? null : Math.floor((now - answeredAt) / 1000)

  const { data: types } = useInteractionTypes()
  const { data: contactTypes } = useInteractionContactTypes()
  // Communication channel: Call / Messenger / Mail / Chat. These are subtypes,
  // not interaction types — the types list is Incoming / Outgoing / Searching,
  // which is the call's direction and not a channel at all.
  const { data: channels } = useInteractionSubtypes()
  const inboundType = types?.find((type) => type.code?.toLowerCase() === 'incoming') ?? types?.[0]
  // Filtered the same way AddNoteModal filters them, so the operator is not
  // offered results that do not apply to the channel and reason they picked.
  // The form defaults the channel to the first option, so until the operator
  // touches it the draft holds nothing while a channel is nonetheless what will
  // be filed. Falling back to the same default keeps the results query and the
  // filed subtype describing the same channel.
  const effectiveChannelId = draft.channelId ?? channels?.[0]?.id
  const { data: results } = useInteractionResults({
    typeId: inboundType?.id,
    channelId: effectiveChannelId,
    contactTypeId: draft.reasonId ?? undefined,
  })

  // The one event carrying `answered_by` is the DialEnd(ANSWER) broadcast, and
  // the screen-pop waits on a cross-service client lookup while that event does
  // not. An operator who picks up quickly is answered before this window even
  // exists, and nothing later repeats it — so the record is read while the call
  // still looks like it is ringing, and the window catches up from it.
  const { data: callDetails } = useCallDetails(answeredAt === null ? incomingCall.call_id : null)
  useEffect(() => {
    if (answeredAt !== null || !callDetails) return
    if ((callDetails.outcome ?? '').toLowerCase() !== CallOutcome.ANSWERED) return
    // Only when the record names *this* operator. After DialEnd adopts the
    // answering leg this is the answerer; before that, on a ring group, it is
    // still the first-rung agent — so a match is evidence and a mismatch is
    // simply somebody else's call.
    const answering = extensionOf(callDetails.agent_extension)
    const mine = extensionOf(agentExtension)
    if (answering !== null && mine !== null && answering === mine) onAnswered()
  }, [callDetails, answeredAt, agentExtension, onAnswered])

  const answer = useAnswerCall(clients[0]?.clientId, agentExtension)
  const hold = useHoldCall(clients[0]?.clientId, agentExtension)
  const reject = useRejectCall(clients[0]?.clientId, agentExtension)
  const hangup = useHangupCall(clients[0]?.clientId)
  const saveInteraction = useCreateBulkInteraction()

  // Nothing can be filed without the interaction type, and an operator who
  // presses Save while the lookups are unavailable used to get silence — no
  // toast, no error, no saved state. Disabling says so instead.
  // At least one client, always. `interactions.client_id` is NOT NULL and the
  // bulk endpoint requires a non-empty list, so an interaction for a caller who
  // matched nobody cannot be stored at all — offering Save for it only produces
  // a 422 and a generic failure toast after the operator has typed it up.
  const canSaveInteraction = Boolean(inboundType) && includedClientIds.length > 0

  const handleSave = async (draft: CallInteractionDraft) => {
    if (!inboundType) return
    await saveInteraction.mutateAsync({
      clientIds: includedClientIds,
      typeId: inboundType.id,
      subtypeId: draft.channelId ?? effectiveChannelId,
      resultId: draft.resultId,
      contactTypeId: draft.reasonId ?? undefined,
      phoneUsed: incomingCall.customer_phone,
      summary: draft.comment || undefined,
      relatedCallUuid: incomingCall.call_id,
    })
    // Only after the server confirms: there is no way to revise an interaction
    // once filed, so an optimistic confirmation would be a lie the operator
    // cannot correct.
    setInteractionSaved(true)
    toast.success(t('pages.clients.modals.callDialog.interaction.saved', 'Interaction saved'))
  }

  // Rendered by the header while minimised, but this stays mounted: the draft
  // lives here, and unmounting would take a comment written mid-call with it.
  if (minimized) return null

  return (
    <IncomingCallWindow
      phoneNumber={incomingCall.customer_phone}
      clients={clients}
      phase={phase}
      durationSeconds={durationSeconds}
      isIncluded={isIncluded}
      onIncludedChange={setIncluded}
      results={asOptions(results)}
      reasons={asOptions(contactTypes)}
      channels={asOptions(channels)}
      onSaveInteraction={handleSave}
      saveDisabled={!canSaveInteraction}
      interactionSaved={interactionSaved}
      interactionDraft={draft}
      onInteractionDraftChange={setDraft}
      onMinimize={onMinimize}
      onAccept={
        answerEnabled
          ? () =>
              answer.mutate(incomingCall.call_id, {
                // Local knowledge is the earliest and most reliable signal that
                // this operator holds the call; the state event may not name an
                // answerer at all.
                onSuccess: onAnswered,
              })
          : undefined
      }
      held={held}
      onHold={
        answerEnabled
          ? () =>
              hold.mutate(
                { callId: incomingCall.call_id, hold: !held },
                // Flipped only once Asterisk agrees, or a failed retrieve
                // leaves the button saying the caller is back when they are
                // still listening to music.
                { onSuccess: () => setHeld((current) => !current) }
              )
          : undefined
      }
      ended={isEnded}
      onCancel={() => {
        // Nothing to end once the line is down: the window is only still here
        // so the interaction could be filed, and posting a hangup for a
        // channel Asterisk has torn down fails — leaving a window that cannot
        // be dismissed while it holds the store registration that blocks
        // click-to-call.
        if (isEnded) {
          onDismiss()
          return
        }
        if (phase === 'connected') {
          // The conversation happened, so there is something to write up. The
          // window survives the operator's own hang-up exactly as it survives
          // the caller's — otherwise a draft written during the call is thrown
          // away by the ordinary act of ending it, with no warning and no way
          // back, and an interaction cannot be revised once filed.
          hangup.mutate(incomingCall.call_id, {
            onSettled: () => setEndedByOperator(true),
          })
          return
        }
        // Declining a call that never connected leaves nothing to file — the
        // interaction form only exists once connected — so this one goes.
        // Dismissed on settle rather than success so a failed reject cannot
        // strand the window; the mutation's own toast reports the failure.
        reject.mutate(incomingCall.call_id, { onSettled: onDismiss })
      }}
      acceptPending={answer.isPending}
      holdPending={hold.isPending}
      cancelPending={reject.isPending || hangup.isPending}
    />
  )
}
