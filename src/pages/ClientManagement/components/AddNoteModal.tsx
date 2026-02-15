/**
 * Add Interaction Modal Component
 *
 * Modal for creating interaction records from the client detail page.
 * Fetches types, subtypes, and results from the interaction service.
 * Shows conditional promise fields based on the selected result.
 */

import { useState, useMemo } from 'react'
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
  useInteractionTypes,
  useInteractionSubtypes,
  useInteractionResults,
} from '@/features/clients/hooks/useNoteInteraction'

export interface AddNoteModalProps {
  open: boolean
  onClose: () => void
  phoneNumber: string
  clientId: number
  onSave: (data: InteractionCreateData) => void
}

export interface InteractionCreateData {
  type_id: number
  subtype_id: number
  result_id?: number
  summary: string
  promise_to_pay_date?: string
  promise_to_pay_amount?: number
}

// Keep old name as alias for backwards compatibility
export type NoteCreateData = InteractionCreateData

const MAX_NOTE_LENGTH = 2000

export function AddNoteModal({ open, onClose, phoneNumber, onSave }: AddNoteModalProps) {
  const { t } = useTranslation('common')

  const [typeId, setTypeId] = useState<number | undefined>(undefined)
  const [subtypeId, setSubtypeId] = useState<number | undefined>(undefined)
  const [resultId, setResultId] = useState<number | undefined>(undefined)
  const [note, setNote] = useState<string>('')
  const [promiseDate, setPromiseDate] = useState<string>('')
  const [promiseAmount, setPromiseAmount] = useState<string>('')

  const { data: types, isLoading: isLoadingTypes } = useInteractionTypes()
  const { data: subtypes, isLoading: isLoadingSubtypes } = useInteractionSubtypes()
  const { data: results, isLoading: isLoadingResults } = useInteractionResults()

  const selectedResult = useMemo(() => results?.find((r) => r.id === resultId), [results, resultId])

  const showPromiseDate = selectedResult?.requires_promise_date === true
  const showPromiseAmount = selectedResult?.requires_promise_amount === true

  const handleSave = () => {
    if (!typeId) {
      toast.error(t('pages.clients.modals.addNote.selectType', 'Please select a type'))
      return
    }
    if (!subtypeId) {
      toast.error(t('pages.clients.modals.addNote.selectSubtype', 'Please select a subtype'))
      return
    }

    const data: InteractionCreateData = {
      type_id: typeId,
      subtype_id: subtypeId,
      result_id: resultId,
      summary: note,
      promise_to_pay_date: showPromiseDate && promiseDate ? promiseDate : undefined,
      promise_to_pay_amount:
        showPromiseAmount && promiseAmount ? parseFloat(promiseAmount) : undefined,
    }

    onSave(data)
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setTypeId(undefined)
    setSubtypeId(undefined)
    setResultId(undefined)
    setNote('')
    setPromiseDate('')
    setPromiseAmount('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const isLoading = isLoadingTypes || isLoadingSubtypes || isLoadingResults

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

          {/* Type Dropdown */}
          <div className="flex flex-col gap-2">
            <label
              className="text-dark-500 text-xs font-light sm:text-sm"
              htmlFor="interaction-type"
            >
              {t('pages.clients.modals.addNote.type', 'Type')}:
            </label>
            {isLoadingTypes ? (
              <div className="text-xs text-gray-500">Loading...</div>
            ) : (
              <Select
                value={typeId?.toString()}
                onValueChange={(value) => setTypeId(Number(value))}
              >
                <SelectTrigger className="w-full" id="interaction-type" aria-label="Type">
                  <SelectValue
                    placeholder={t(
                      'pages.clients.modals.addNote.selectTypeOfAction',
                      'Select type'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {types?.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Subtype Dropdown */}
          <div className="flex flex-col gap-2">
            <label
              className="text-dark-500 text-xs font-light sm:text-sm"
              htmlFor="interaction-subtype"
            >
              {t('pages.clients.modals.addNote.subtype', 'Subtype')}:
            </label>
            {isLoadingSubtypes ? (
              <div className="text-xs text-gray-500">Loading...</div>
            ) : (
              <Select
                value={subtypeId?.toString()}
                onValueChange={(value) => setSubtypeId(Number(value))}
              >
                <SelectTrigger className="w-full" id="interaction-subtype" aria-label="Subtype">
                  <SelectValue
                    placeholder={t('pages.clients.modals.addNote.selectSubtype', 'Select subtype')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {subtypes?.map((subtype) => (
                    <SelectItem key={subtype.id} value={subtype.id.toString()}>
                      {subtype.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Result Dropdown (optional) */}
          <div className="flex flex-col gap-2">
            <label
              className="text-dark-500 text-xs font-light sm:text-sm"
              htmlFor="interaction-result"
            >
              {t('pages.clients.modals.addNote.result', 'Result')}:
            </label>
            {isLoadingResults ? (
              <div className="text-xs text-gray-500">Loading...</div>
            ) : (
              <Select
                value={resultId?.toString()}
                onValueChange={(value) => setResultId(Number(value))}
              >
                <SelectTrigger className="w-full" id="interaction-result" aria-label="Result">
                  <SelectValue
                    placeholder={t(
                      'pages.clients.modals.addNote.selectResult',
                      'Select result (optional)'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {results?.map((result) => (
                    <SelectItem key={result.id} value={result.id.toString()}>
                      {result.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Promise to Pay Date (conditional) */}
          {showPromiseDate && (
            <div className="flex flex-col gap-2">
              <label className="text-dark-500 text-xs font-light sm:text-sm" htmlFor="promise-date">
                {t('pages.clients.modals.addNote.promiseDate', 'Promise date')}:
              </label>
              <input
                type="date"
                id="promise-date"
                value={promiseDate}
                onChange={(e) => setPromiseDate(e.target.value)}
                className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-light focus:ring-2 focus:outline-none sm:text-sm"
              />
            </div>
          )}

          {/* Promise to Pay Amount (conditional) */}
          {showPromiseAmount && (
            <div className="flex flex-col gap-2">
              <label
                className="text-dark-500 text-xs font-light sm:text-sm"
                htmlFor="promise-amount"
              >
                {t('pages.clients.modals.addNote.promiseAmount', 'Promise amount')}:
              </label>
              <input
                type="number"
                id="promise-amount"
                value={promiseAmount}
                onChange={(e) => setPromiseAmount(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-light placeholder:text-gray-400 focus:ring-2 focus:outline-none sm:text-sm"
              />
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
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isLoading}
          className="w-full rounded-md"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default AddNoteModal
