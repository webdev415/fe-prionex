import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useCallMonitoring } from '@/features/training'
import type { CallMonitoringItem, TelephonyType } from '@/features/training'
import { useCreateScorecard, useTemplates } from '@/features/quality'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'

/**
 * New-assessment picker (KAN-504 / Scorecard Review Panel redesign).
 *
 * A single modal: pick the operator (searchable) and one of that operator's
 * recent recorded calls (last_30d by default; filterable by dialing type,
 * call date and min talk duration — KAN-827), then **Add** — which creates a
 * draft scorecard (default Client type, changeable later in the review panel)
 * that appears in the Dialogue Evaluation list with no score yet. The trainer
 * then selects that row to review the call in the inline CallReviewPanel.
 *
 * ``operatorId`` is an optional *initial* selection — when opened from a
 * context that already knows the operator (e.g. Quick Action → Rate
 * dialogue), the operator is pre-selected but stays changeable.
 */
export interface RateDialogueDialogProps {
  open: boolean
  onClose: () => void
  operatorId?: number
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

  const [selectedOperatorId, setSelectedOperatorId] = useState<number | null>(operatorId ?? null)
  const [selectedCall, setSelectedCall] = useState<CallMonitoringItem | null>(null)
  const [operatorQuery, setOperatorQuery] = useState('')
  // KAN-827: let trainers narrow an operator's calls when picking one to rate.
  const [telephonyType, setTelephonyType] = useState<'' | TelephonyType>('')
  const [callFrom, setCallFrom] = useState('')
  const [callTo, setCallTo] = useState('')
  const [minDuration, setMinDuration] = useState('')

  // Reset selection each time the modal opens (render-time adjustment, no
  // effect): honour the caller-provided operator as the initial pick.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    setSelectedOperatorId(open ? (operatorId ?? null) : null)
    setSelectedCall(null)
    setOperatorQuery('')
    setTelephonyType('')
    setCallFrom('')
    setCallTo('')
    setMinDuration('')
  }

  const filteredOperators = useMemo(() => {
    const q = operatorQuery.trim().toLowerCase()
    if (!q) return operators
    return operators.filter((o) => (o.full_name ?? `#${o.id}`).toLowerCase().includes(q))
  }, [operators, operatorQuery])

  const operator = selectedOperatorId
    ? operators.find((o) => o.id === selectedOperatorId)
    : undefined
  const extension = operator?.asterisk_extension ?? null

  const useCustomRange = !!(callFrom || callTo)
  const { data: callsData, isLoading } = useCallMonitoring(
    {
      agent_extensions: extension ? [extension] : [],
      period: useCustomRange ? undefined : 'last_30d',
      from_datetime: callFrom ? new Date(`${callFrom}T00:00:00`).toISOString() : undefined,
      to_datetime: callTo ? new Date(`${callTo}T23:59:59.999`).toISOString() : undefined,
      telephony_types: telephonyType ? [telephonyType] : undefined,
      min_duration: minDuration ? Number(minDuration) : undefined,
      sort: 'date_desc',
      limit: 50,
    },
    open && !!extension
  )

  const calls = callsData?.calls ?? []

  // "Add" creates a draft scorecard with the default Client type (changeable
  // later in the review panel); it then shows in the Dialogue list with "—".
  const { data: templates = [] } = useTemplates(false)
  const clientTemplateId = templates.find((tpl) => tpl.scorecard_type === 'client')?.id ?? null
  const createMutation = useCreateScorecard()

  const handlePickCall = (call: CallMonitoringItem) => {
    if (!call.has_recording) return
    setSelectedCall((prev) => (prev?.call_id === call.call_id ? null : call))
  }

  const closeAll = () => {
    setSelectedCall(null)
    onClose()
  }

  const handleAdd = async () => {
    if (!selectedCall || selectedOperatorId == null || clientTemplateId == null) return
    await createMutation.mutateAsync({
      call_id: selectedCall.call_id,
      operator_id: selectedOperatorId,
      template_id: clientTemplateId,
      status: 'draft',
    })
    toast.success(
      t('pages.training.dialogue.newAssessmentPicker.added', 'Assessment added to the list')
    )
    closeAll()
  }

  const renderCallList = () => {
    if (!selectedOperatorId) {
      return (
        <p className="px-1 py-8 text-center text-sm text-gray-500">
          {t(
            'pages.training.dialogue.newAssessmentPicker.pickOperatorHint',
            'Select an operator to see their recent calls.'
          )}
        </p>
      )
    }
    if (!extension) {
      return (
        <p className="px-1 py-8 text-center text-sm text-gray-500">
          {t(
            'pages.training.inbox.rateDialogue.noExtension',
            'This operator has no telephony extension and no calls to rate.'
          )}
        </p>
      )
    }
    if (isLoading) {
      return (
        <p className="px-1 py-8 text-center text-sm text-gray-500">
          {t('pages.training.inbox.detail.loading', 'Loading…')}
        </p>
      )
    }
    if (calls.length === 0) {
      return (
        <p className="px-1 py-8 text-center text-sm text-gray-500">
          {t('pages.training.inbox.rateDialogue.noCalls', 'No recent calls for this operator.')}
        </p>
      )
    }
    return (
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
                  'flex w-full items-center justify-between gap-4 rounded-md px-2 py-3 text-left text-sm transition-colors',
                  disabled
                    ? 'cursor-not-allowed opacity-50'
                    : selectedCall?.call_id === call.call_id
                      ? 'bg-primary-50 ring-primary-500 ring-1'
                      : 'hover:bg-primary-50',
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
                      ? t('pages.training.inbox.rateDialogue.hasRecording', 'Recording available')
                      : t('pages.training.inbox.rateDialogue.noRecording', 'No recording'))}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <>
      <Modal open={open} onClose={closeAll} maxWidth="lg">
        <ModalHeader
          title={t('pages.training.dialogue.newAssessmentPicker.title', 'New assessment')}
        />
        <ModalContent>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">
              {t('pages.training.dialogue.newAssessmentPicker.operator', 'Operator')}
            </label>

            {selectedOperatorId == null ? (
              <div className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={operatorQuery}
                  onChange={(e) => setOperatorQuery(e.target.value)}
                  placeholder={t(
                    'pages.training.dialogue.newAssessmentPicker.searchOperator',
                    'Search operator by name…'
                  )}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100">
                  {filteredOperators.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-gray-500">
                      {t(
                        'pages.training.dialogue.newAssessmentPicker.noMatches',
                        'No operators match'
                      )}
                    </p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {filteredOperators.map((op) => (
                        <li key={op.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOperatorId(op.id)
                              setSelectedCall(null)
                            }}
                            className="hover:bg-primary-50 block w-full px-3 py-2 text-left text-sm text-gray-700"
                          >
                            {op.full_name ?? `#${op.id}`}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-dark-500 truncate text-sm font-medium">
                  {operator?.full_name ?? `#${selectedOperatorId}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOperatorId(null)
                    setOperatorQuery('')
                    setSelectedCall(null)
                  }}
                  className="text-primary-600 flex-shrink-0 text-xs hover:underline"
                >
                  {t('pages.training.dialogue.newAssessmentPicker.change', 'Change')}
                </button>
              </div>
            )}

            {selectedOperatorId != null && extension ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
                <select
                  value={telephonyType}
                  onChange={(e) => setTelephonyType(e.target.value as '' | TelephonyType)}
                  className="h-8 rounded-lg border border-gray-200 px-2 text-xs"
                >
                  <option value="">
                    {t('pages.training.dialogue.filters.allTypes', 'All types')}
                  </option>
                  <option value="white">
                    {t('pages.training.dialogue.filters.white', 'White')}
                  </option>
                  <option value="grey">{t('pages.training.dialogue.filters.grey', 'Grey')}</option>
                  <option value="unknown">
                    {t('pages.training.dialogue.filters.unknown', 'Unknown')}
                  </option>
                </select>
                <input
                  type="date"
                  value={callFrom}
                  onChange={(e) => setCallFrom(e.target.value)}
                  className="h-8 rounded-lg border border-gray-200 px-2 text-xs"
                />
                <span className="text-[10px] text-gray-400">–</span>
                <input
                  type="date"
                  value={callTo}
                  onChange={(e) => setCallTo(e.target.value)}
                  className="h-8 rounded-lg border border-gray-200 px-2 text-xs"
                />
                <input
                  type="number"
                  min={0}
                  value={minDuration}
                  onChange={(e) => setMinDuration(e.target.value)}
                  placeholder={t('pages.training.dialogue.filters.minDuration', 'Min talk (sec)')}
                  className="h-8 w-[120px] rounded-lg border border-gray-200 px-2 text-xs"
                />
              </div>
            ) : null}

            {selectedOperatorId != null ? (
              <div className="border-t border-gray-100 pt-1">{renderCallList()}</div>
            ) : null}
          </div>
        </ModalContent>
        <ModalFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {selectedCall && clientTemplateId == null ? (
            <span className="text-xs text-red-500 sm:mr-auto">
              {t(
                'pages.training.dialogue.newAssessmentPicker.noTemplate',
                'No scorecard template found for this project.'
              )}
            </span>
          ) : null}
          <Button variant="cancel" size="sm" onClick={closeAll} className="rounded-full">
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleAdd}
            disabled={!selectedCall || clientTemplateId == null || createMutation.isPending}
            className="rounded-full"
          >
            {t('pages.training.dialogue.newAssessmentPicker.add', 'Add')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}

export default RateDialogueDialog
