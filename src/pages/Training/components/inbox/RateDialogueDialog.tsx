import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal'
import { useCallMonitoring } from '@/features/training'
import type { CallMonitoringItem } from '@/features/training'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'
import { CallReviewLayout } from '../CallReviewLayout'

/**
 * Recent-calls picker invoked by Quick-Action "Rate dialogue" + the
 * OperatorDetailPanel "Listen to the call" button.
 *
 * Resolves operator_id -> asterisk_extension via the cached operator list,
 * fetches the operator's last 10 calls (last_30d window), and opens a
 * CallReviewLayout when the trainer picks one.
 *
 * If the operator has no recorded asterisk_extension (e.g. an admin user
 * who never received a phone provisioning), the dialog shows an empty
 * state — there are no calls to rate.
 */
export interface RateDialogueDialogProps {
  open: boolean
  onClose: () => void
  operatorId: number | undefined
}

function formatTime(value: string): { date: string; time: string } {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' }
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function RateDialogueDialog({ open, onClose, operatorId }: RateDialogueDialogProps) {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const operator = operatorId ? operators.find((o) => o.id === operatorId) : undefined
  const extension = operator?.asterisk_extension ?? null

  const { data: callsData, isLoading } = useCallMonitoring(
    {
      agent_extensions: extension ? [extension] : [],
      period: 'last_30d',
      sort: 'date_desc',
      limit: 10,
    },
    open && !!extension
  )

  const calls = callsData?.calls ?? []
  const [selectedCall, setSelectedCall] = useState<CallMonitoringItem | null>(null)

  const handlePickCall = (call: CallMonitoringItem) => {
    if (!call.has_recording) return
    setSelectedCall(call)
  }

  const closeReview = () => setSelectedCall(null)

  const closeAll = () => {
    setSelectedCall(null)
    onClose()
  }

  const renderEmptyState = () => {
    if (!operatorId) {
      return (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          {t('pages.training.inbox.rateDialogue.noOperator', 'Select an operator first.')}
        </p>
      )
    }
    if (!extension) {
      return (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          {t(
            'pages.training.inbox.rateDialogue.noExtension',
            'This operator has no telephony extension and no calls to rate.'
          )}
        </p>
      )
    }
    if (isLoading) {
      return (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          {t('pages.training.inbox.detail.loading', 'Loading…')}
        </p>
      )
    }
    if (calls.length === 0) {
      return (
        <p className="px-4 py-8 text-center text-sm text-gray-500">
          {t('pages.training.inbox.rateDialogue.noCalls', 'No recent calls for this operator.')}
        </p>
      )
    }
    return null
  }

  const emptyState = renderEmptyState()

  return (
    <>
      <Modal open={open && !selectedCall} onClose={closeAll} maxWidth="lg">
        <ModalHeader title={t('pages.training.inbox.rateDialogue.title', 'Pick a call to rate')} />
        <ModalContent>
          {emptyState ?? (
            <ul className="divide-y divide-gray-100">
              {calls.map((call) => {
                const start = formatTime(call.initiated_at)
                const disabled = !call.has_recording
                return (
                  <li key={call.call_id}>
                    <button
                      type="button"
                      onClick={() => handlePickCall(call)}
                      disabled={disabled}
                      className={[
                        'flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm transition-colors',
                        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-primary-50',
                      ].join(' ')}
                    >
                      <div className="flex flex-col">
                        <span className="text-dark-500 font-medium">
                          {start.date} · {start.time}
                        </span>
                        <span className="text-xs text-gray-500">
                          {call.customer_number} · {formatDuration(call.talk_duration)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {call.outcome ??
                          (call.has_recording
                            ? t(
                                'pages.training.inbox.rateDialogue.hasRecording',
                                'Recording available'
                              )
                            : t('pages.training.inbox.rateDialogue.noRecording', 'No recording'))}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ModalContent>
      </Modal>

      {selectedCall && operatorId ? (
        <CallReviewLayout
          open={true}
          onClose={closeReview}
          callId={selectedCall.call_id}
          operatorId={operatorId}
          callData={{
            type: selectedCall.direction ?? 'outbound',
            clientName: operator?.full_name ?? `#${operatorId}`,
            date: formatTime(selectedCall.initiated_at).date,
            time: formatTime(selectedCall.initiated_at).time,
            operator: operator?.full_name ?? '',
            duration: formatDuration(selectedCall.talk_duration),
            phone: selectedCall.customer_number,
            call_id: selectedCall.call_id,
            clientId: selectedCall.client_id,
            direction: selectedCall.direction,
            telephony_type: selectedCall.telephony_type,
          }}
        />
      ) : null}
    </>
  )
}

export default RateDialogueDialog
