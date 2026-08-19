import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import {
  useInteractionContactTypes,
  useInteractionResults,
  useInteractionTypes,
  useCreateBulkInteraction,
} from '@/features/clients/hooks/useNoteInteraction'
import { useAnswerCall, useHangupCall, useHoldCall, useRejectCall } from '../hooks/useCall'
import { useIncludedClients } from '../hooks/useIncludedClients'
import { useCallStore } from '@/stores/callStore'
import { buildMatchedClients } from '../utils/callWindow'
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
const ANSWER_FROM_CRM_ENABLED = import.meta.env.VITE_CALL_ANSWER_ENABLED === 'true'

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
  onDismiss,
}: IncomingCallWindowContainerProps) {
  const { t } = useTranslation('common')
  const clients = useMemo(() => buildMatchedClients(incomingCall), [incomingCall])
  const { isIncluded, setIncluded, includedClientIds } = useIncludedClients(clients)
  const [interactionSaved, setInteractionSaved] = useState(false)
  // Held here rather than inside the form: minimising unmounts the window, and
  // a comment written while the caller is on the line cannot be recovered.
  const [draft, setDraft] = useState<Partial<CallInteractionDraftState>>({})

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

  const phase: CallPhase = answeredAt === null ? 'ringing' : 'connected'
  // Ticks the conversation clock. Derived from the answer time rather than
  // counted up, so a re-render or a minimise-and-restore cannot drift it.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (answeredAt === null || ended) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [answeredAt, ended])
  const durationSeconds = answeredAt === null ? null : Math.floor((now - answeredAt) / 1000)

  const { data: types } = useInteractionTypes()
  const { data: contactTypes } = useInteractionContactTypes()
  const inboundType = types?.find((type) => type.code?.toLowerCase() === 'incoming') ?? types?.[0]
  const { data: results } = useInteractionResults({ typeId: inboundType?.id })

  const answer = useAnswerCall(clients[0]?.clientId, agentExtension)
  const hold = useHoldCall(clients[0]?.clientId, agentExtension)
  const reject = useRejectCall(clients[0]?.clientId, agentExtension)
  const hangup = useHangupCall(clients[0]?.clientId)
  const saveInteraction = useCreateBulkInteraction()

  const handleSave = async (draft: CallInteractionDraft) => {
    if (!inboundType) return
    await saveInteraction.mutateAsync({
      // An unknown caller still gets an interaction; it simply belongs to
      // nobody's card, so the request carries no clients.
      clientIds: includedClientIds,
      typeId: inboundType.id,
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
      channels={asOptions(types)}
      onSaveInteraction={handleSave}
      interactionSaved={interactionSaved}
      interactionDraft={draft}
      onInteractionDraftChange={setDraft}
      onMinimize={onMinimize}
      onAccept={
        ANSWER_FROM_CRM_ENABLED
          ? () =>
              answer.mutate(incomingCall.call_id, {
                // Local knowledge is the earliest and most reliable signal that
                // this operator holds the call; the state event may not name an
                // answerer at all.
                onSuccess: onAnswered,
              })
          : undefined
      }
      onHold={
        ANSWER_FROM_CRM_ENABLED
          ? () => hold.mutate({ callId: incomingCall.call_id, hold: true })
          : undefined
      }
      ended={ended}
      onCancel={() => {
        // Reject declines a call that is still ringing and records it as
        // declined; once connected the call is hung up instead, or a finished
        // conversation is filed as one the operator refused.
        const ending = phase === 'connected' ? hangup : reject
        // Dismissed only once the request lands. Closing first leaves the line
        // up with no window to retry from, and makes `cancelPending` a state
        // nothing can ever render.
        ending.mutate(incomingCall.call_id, { onSuccess: onDismiss })
      }}
      acceptPending={answer.isPending}
      holdPending={hold.isPending}
      cancelPending={reject.isPending || hangup.isPending}
    />
  )
}
