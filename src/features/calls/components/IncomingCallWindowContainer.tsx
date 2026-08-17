import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

import {
  useInteractionContactTypes,
  useInteractionResults,
  useInteractionTypes,
  useCreateBulkInteraction,
} from '@/features/clients/hooks/useNoteInteraction'
import { useAnswerCall, useHoldCall, useRejectCall } from '../hooks/useCall'
import { useIncludedClients } from '../hooks/useIncludedClients'
import { buildMatchedClients } from '../utils/callWindow'
import type { IncomingCallData } from '../types'
import { IncomingCallWindow } from './IncomingCallWindow'
import type { CallInteractionDraft } from './CallInteractionForm'
import type { CallPhase } from './CallActions'

interface IncomingCallWindowContainerProps {
  incomingCall: IncomingCallData
  /** When this operator took the call, or null while it is still ringing. */
  answeredAt: number | null
  /** Called when Accept succeeds: the answer is known here before any event. */
  onAnswered: () => void
  agentExtension: string | null
  onMinimize: () => void
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
  onMinimize,
  onDismiss,
}: IncomingCallWindowContainerProps) {
  const { t } = useTranslation('common')
  const clients = useMemo(() => buildMatchedClients(incomingCall), [incomingCall])
  const { isIncluded, setIncluded, includedClientIds } = useIncludedClients(clients)
  const [interactionSaved, setInteractionSaved] = useState(false)

  const phase: CallPhase = answeredAt === null ? 'ringing' : 'connected'
  // Ticks the conversation clock. Derived from the answer time rather than
  // counted up, so a re-render or a minimise-and-restore cannot drift it.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (answeredAt === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [answeredAt])
  const durationSeconds = answeredAt === null ? null : Math.floor((now - answeredAt) / 1000)

  const { data: types } = useInteractionTypes()
  const { data: contactTypes } = useInteractionContactTypes()
  const inboundType = types?.find((type) => type.code?.toLowerCase() === 'incoming') ?? types?.[0]
  const { data: results } = useInteractionResults({ typeId: inboundType?.id })

  const answer = useAnswerCall(clients[0]?.clientId, agentExtension)
  const hold = useHoldCall(clients[0]?.clientId, agentExtension)
  const reject = useRejectCall(clients[0]?.clientId, agentExtension)
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
      onMinimize={onMinimize}
      onAccept={() =>
        answer.mutate(incomingCall.call_id, {
          // Local knowledge is the earliest and most reliable signal that this
          // operator holds the call; the state event may not name an answerer
          // at all.
          onSuccess: onAnswered,
        })
      }
      onHold={() => hold.mutate({ callId: incomingCall.call_id, hold: true })}
      onCancel={() => {
        reject.mutate(incomingCall.call_id)
        onDismiss()
      }}
      acceptPending={answer.isPending}
      holdPending={hold.isPending}
      cancelPending={reject.isPending}
    />
  )
}
