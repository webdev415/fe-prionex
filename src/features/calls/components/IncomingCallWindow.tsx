import { useTranslation } from 'react-i18next'

import { Modal } from '@/components/ui/Modal'
import { CallActions, type CallPhase } from './CallActions'
import { CallClientContracts, type CallMatchedClient } from './CallClientContracts'
import {
  CallInteractionForm,
  type InteractionOption,
  type CallInteractionDraft,
} from './CallInteractionForm'
import { CallWindowHeader } from './CallWindowHeader'

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
  onSaveInteraction: (draft: CallInteractionDraft) => Promise<void> | void
  interactionSaved: boolean
  onMinimize: () => void
  onAccept: () => void
  onCancel: () => void
  onHold: () => void
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
  onSaveInteraction,
  interactionSaved,
  onMinimize,
  onAccept,
  onCancel,
  onHold,
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
          durationSeconds={connected ? (durationSeconds ?? 0) : null}
          onMinimize={onMinimize}
        />

        {/* Only this scrolls. The number above and the actions below are what
            the operator acts on, and must not leave the screen. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto sm:gap-5">
          {clients.length === 0 ? (
            <p className="text-muted-foreground text-center text-xs">
              {t(
                'pages.clients.modals.callDialog.clientNotFoundHint',
                'This number is not linked to any client in your projects.'
              )}
            </p>
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
            />
          )}
        </div>

        <CallActions
          phase={phase}
          onAccept={onAccept}
          onCancel={onCancel}
          onHold={onHold}
          acceptPending={acceptPending}
          holdPending={holdPending}
          cancelPending={cancelPending}
        />
      </div>
    </Modal>
  )
}
