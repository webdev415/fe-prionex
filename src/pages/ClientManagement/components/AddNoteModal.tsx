/**
 * Add Note Modal Component (Enhanced)
 *
 * Reusable modal for adding notes about clients.
 * Supports 8 note types with conditional related fields (call/payment/debt).
 * Implements lazy-loading data fetching for related records.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select'
import { Icons } from '@/lib/icons'
import { toast } from 'sonner'
import {
  useClientCallSmsHistory,
  useClientPaymentsSection,
  useClientLoans,
} from '@/features/clients/hooks/useClients'

export interface AddNoteModalProps {
  open: boolean
  onClose: () => void
  phoneNumber: string
  clientId: number
  onSave: (data: NoteCreateData) => void
}

export interface NoteCreateData {
  content: string
  note_type?: string
  related_call_id?: number
  related_payment_id?: number
  related_debt_id?: number
}

// 8 semantic note types matching backend schema
const NOTE_TYPE_OPTIONS = [
  'general',
  'call',
  'payment',
  'debt',
  'follow_up',
  'reminder',
  'legal',
  'other',
] as const

const MAX_NOTE_LENGTH = 2000

export function AddNoteModal({ open, onClose, phoneNumber, clientId, onSave }: AddNoteModalProps) {
  const { t } = useTranslation('common')
  const [noteType, setNoteType] = useState<string>('general')
  const [note, setNote] = useState<string>('')
  const [relatedCallId, setRelatedCallId] = useState<number | undefined>(undefined)
  const [relatedPaymentId, setRelatedPaymentId] = useState<number | undefined>(undefined)
  const [relatedDebtId, setRelatedDebtId] = useState<number | undefined>(undefined)

  // Lazy-loading data fetching - only fetch when needed
  const shouldFetchCalls = noteType === 'call'
  const shouldFetchPayments = noteType === 'payment'
  const shouldFetchDebts = noteType === 'debt'

  const {
    data: callData,
    isLoading: isLoadingCalls,
    isError: isCallsError,
  } = useClientCallSmsHistory(clientId, shouldFetchCalls)
  const {
    data: paymentData,
    isLoading: isLoadingPayments,
    isError: isPaymentsError,
  } = useClientPaymentsSection(clientId, shouldFetchPayments)
  const {
    data: debtData,
    isLoading: isLoadingDebts,
    isError: isDebtsError,
  } = useClientLoans(clientId, shouldFetchDebts)

  const handleSave = () => {
    if (!note.trim()) {
      toast.error('Please enter a note before saving')
      return
    }

    // Only include related fields that match the current note type
    const data: NoteCreateData = {
      content: note,
      note_type: noteType,
      related_call_id: noteType === 'call' ? relatedCallId : undefined,
      related_payment_id: noteType === 'payment' ? relatedPaymentId : undefined,
      related_debt_id: noteType === 'debt' ? relatedDebtId : undefined,
    }

    onSave(data)

    // Reset form
    setNoteType('general')
    setNote('')
    setRelatedCallId(undefined)
    setRelatedPaymentId(undefined)
    setRelatedDebtId(undefined)
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setNoteType('general')
    setNote('')
    setRelatedCallId(undefined)
    setRelatedPaymentId(undefined)
    setRelatedDebtId(undefined)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
            <Icons.PencilEdit size={20} className="text-dark-500 sm:size-6" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.addNote.title')}
      />
      <ModalContent>
        <div className="flex flex-col gap-4 md:gap-6">
          {/* Phone Field */}
          <div className="flex flex-row items-center gap-2 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-dark-500 text-xs font-light sm:text-sm">
                {t('pages.clients.modals.addNote.phone')}:
              </span>
              <span className="text-dark-500 text-xs font-light sm:text-sm">{phoneNumber}</span>
            </div>
            <button className="bg-primary-300 flex items-center gap-1 rounded-full px-2 py-1 sm:px-3 sm:py-1.5">
              <Icons.Headset size={14} className="text-dark-500 sm:size-4" strokeWidth={1.5} />
              <span className="text-dark-500 text-[10px] font-medium sm:text-xs">
                {t('pages.clients.activity.call')}
              </span>
            </button>
          </div>

          {/* Note Type Dropdown (8 options) */}
          <div className="flex flex-col gap-2">
            <label className="text-dark-500 text-xs font-light sm:text-sm" htmlFor="note-type">
              Note Type:
            </label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="w-full" id="note-type" aria-label="Note Type">
                <SelectValue placeholder="Select note type" />
              </SelectTrigger>
              <SelectContent>
                {NOTE_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Related Call Field */}
          {noteType === 'call' && (
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs font-light sm:text-sm" htmlFor="related-call">
                Related Call:
              </label>
              {isLoadingCalls ? (
                <div className="text-xs text-gray-500">Loading...</div>
              ) : isCallsError ? (
                <Select disabled>
                  <SelectTrigger className="w-full" id="related-call" aria-label="Related Call">
                    <SelectValue placeholder="Error loading calls" />
                  </SelectTrigger>
                </Select>
              ) : (
                <Select
                  value={relatedCallId?.toString()}
                  onValueChange={(value) => setRelatedCallId(Number(value))}
                >
                  <SelectTrigger className="w-full" id="related-call" aria-label="Related Call">
                    <SelectValue placeholder="Select related call (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {callData?.calls?.map((call) => (
                      <SelectItem key={call.id} value={call.id.toString()}>
                        Call #{call.id} - {call.phone} ({call.duration}s)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Conditional Related Payment Field */}
          {noteType === 'payment' && (
            <div className="flex flex-col gap-2">
              <label
                className="text-dark-500 text-xs font-light sm:text-sm"
                htmlFor="related-payment"
              >
                Related Payment:
              </label>
              {isLoadingPayments ? (
                <div className="text-xs text-gray-500">Loading...</div>
              ) : isPaymentsError ? (
                <Select disabled>
                  <SelectTrigger
                    className="w-full"
                    id="related-payment"
                    aria-label="Related Payment"
                  >
                    <SelectValue placeholder="Error loading payments" />
                  </SelectTrigger>
                </Select>
              ) : (
                <Select
                  value={relatedPaymentId?.toString()}
                  onValueChange={(value) => setRelatedPaymentId(Number(value))}
                >
                  <SelectTrigger
                    className="w-full"
                    id="related-payment"
                    aria-label="Related Payment"
                  >
                    <SelectValue placeholder="Select related payment (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentData?.payments?.map((payment) => (
                      <SelectItem key={payment.id} value={payment.id.toString()}>
                        Payment #{payment.id} - ₴{payment.amount} ({payment.payment_date})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Conditional Related Debt Field */}
          {noteType === 'debt' && (
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs font-light sm:text-sm" htmlFor="related-debt">
                Related Debt:
              </label>
              {isLoadingDebts ? (
                <div className="text-xs text-gray-500">Loading...</div>
              ) : isDebtsError ? (
                <Select disabled>
                  <SelectTrigger className="w-full" id="related-debt" aria-label="Related Debt">
                    <SelectValue placeholder="Error loading debts" />
                  </SelectTrigger>
                </Select>
              ) : (
                <Select
                  value={relatedDebtId?.toString()}
                  onValueChange={(value) => setRelatedDebtId(Number(value))}
                >
                  <SelectTrigger className="w-full" id="related-debt" aria-label="Related Debt">
                    <SelectValue placeholder="Select related debt (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {debtData?.map((debt) => (
                      <SelectItem key={debt.id} value={debt.id.toString()}>
                        {debt.contract_number} - ₴{debt.remaining_debt_amount}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Note Textarea */}
          <div className="flex flex-col gap-2">
            <label className="text-dark-500 text-xs font-light sm:text-sm">
              {t('pages.clients.modals.addNote.note')}:
            </label>
            <div className="relative">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('pages.clients.modals.addNote.typeYourNoteHere')}
                maxLength={MAX_NOTE_LENGTH}
                className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 min-h-[100px] w-full resize-none rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-light placeholder:text-gray-400 focus:ring-2 focus:outline-none sm:min-h-[120px] sm:text-sm"
              />
              <div className="absolute right-2 bottom-2 text-[10px] font-light text-gray-400 sm:text-xs">
                {note.length}/{MAX_NOTE_LENGTH}
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
        <Button variant="cancel" size="sm" onClick={handleClose} className="w-full rounded-md">
          {t('actions.cancel')}
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave} className="w-full rounded-md">
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default AddNoteModal
