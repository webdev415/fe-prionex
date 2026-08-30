import { useTranslation } from 'react-i18next'

import { Modal } from '@/components/ui/Modal'
import { CallActions, type CallPhase } from './CallActions'
import { CallClientContracts, type CallMatchedClient } from './CallClientContracts'
import {
  CallInteractionForm,
  type InteractionOption,
  type CallInteractionDraft,
  type CallInteractionDraftState,
} from './CallInteractionForm'
import { CallClientSearch } from './CallClientSearch'
import { CallWindowHeader } from './CallWindowHeader'
import type { EnhancedSearchResult } from '@/api/clientSearchApi'

interface IncomingCallWindowProps {
  phoneNumber: string
  clients: CallMatchedClient[]
  phase: CallPhase
  /** Absent while ringing; the conversation has not started. */
  durationSeconds?: number | null
  isIncluded: (clientId: number) => boolean
  onIncludedChange: (clientId: number, included: boolean) => void
  results: InteractionOption[]
  reasons: InteractionOption[]
  channels: InteractionOption[]
  /**
   * Offered only while the number matched nobody and none has been found yet.
   * An interaction always belongs to a client, so without this the call cannot
   * be written up at all.
   */
  onFindClient?: (client: EnhancedSearchResult) => void
  onSaveInteraction: (draft: CallInteractionDraft) => Promise<void> | void
  /** Nothing can be filed yet — the lookups are missing, or no client is selected. */
  saveDisabled?: boolean
  interactionSaved: boolean
  interactionDraft?: Partial<CallInteractionDraftState>
  onInteractionDraftChange?: (draft: CallInteractionDraftState) => void
  /** The line is down; the window remains only so the interaction can be filed. */
  ended?: boolean
  onMinimize: () => void
  /** Absent where the deployment cannot answer from the CRM; see the container. */
  onAccept?: () => void
  onCancel: () => void
  /** Absent for the same reason as `onAccept`. */
  onHold?: () => void
  /** The caller is parked; Hold becomes the control that brings them back. */
  held?: boolean
  acceptPending?: boolean
  holdPending?: boolean
  cancelPending?: boolean
}

/**
 * The window an operator works a call in.
 *
 * Four states from two independent facts: whether the line is ringing or
 * connected, and whether the number matched anybody. The interaction form
 * appears only once connected — there is nothing to record about a call that
 * has not been taken — and the contract list only when somebody matched.
 */
export function IncomingCallWindow({
  phoneNumber,
  clients,
  phase,
  durationSeconds,
  isIncluded,
  onIncludedChange,
  results,
  reasons,
  channels,
  onFindClient,
  onSaveInteraction,
  saveDisabled = false,
  interactionSaved,
  interactionDraft,
  onInteractionDraftChange,
  ended = false,
  onMinimize,
  onAccept,
  onCancel,
  onHold,
  held = false,
  acceptPending,
  holdPending,
  cancelPending,
}: IncomingCallWindowProps) {
  const { t } = useTranslation('common')
  const connected = phase === 'connected'
  // The caller is named by whichever client the operator is most likely to be
  // looking at; with several matches there is no single owner of the number.
  const headerName = clients.length === 1 ? clients[0].clientName : null

  return (
    <Modal
      open
      onClose={onMinimize}
      maxWidth="xl"
      className="flex max-h-[90vh] flex-col overflow-hidden p-4 sm:p-6"
      showCloseButton={false}
      preventOutsideClose
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 sm:gap-6">
        <CallWindowHeader
          phoneNumber={phoneNumber}
          clientName={headerName}
          unknown={clients.length === 0}
          durationSeconds={connected ? (durationSeconds ?? 0) : null}
          ended={ended}
          onMinimize={onMinimize}
        />

        {/* Only this scrolls. The number above and the actions below are what
            the operator acts on, and must not leave the screen. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto sm:gap-5">
          {clients.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-center text-xs">
                {t(
                  'pages.clients.modals.callDialog.clientNotFoundHint',
                  'This number is not linked to any client in your projects.'
                )}
              </p>
              {onFindClient && <CallClientSearch onSelect={onFindClient} />}
            </div>
          ) : (
            clients.map((client) => (
              <CallClientContracts
                key={client.clientId}
                client={client}
                included={isIncluded(client.clientId)}
                onIncludedChange={(included) => onIncludedChange(client.clientId, included)}
              />
            ))
          )}

          {connected && (
            <CallInteractionForm
              results={results}
              reasons={reasons}
              channels={channels}
              onSave={onSaveInteraction}
              saved={interactionSaved}
              saveDisabled={saveDisabled}
              initialDraft={interactionDraft}
              onDraftChange={onInteractionDraftChange}
            />
          )}
        </div>

        <CallActions
          phase={phase}
          ended={ended}
          onAccept={onAccept}
          onCancel={onCancel}
          onHold={onHold}
          held={held}
          acceptPending={acceptPending}
          holdPending={holdPending}
          cancelPending={cancelPending}
        />
      </div>
    </Modal>
  )
}
