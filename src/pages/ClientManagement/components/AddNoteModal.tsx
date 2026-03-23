/**
 * Add Interaction Modal Component
 *
 * 4-step sequential form:
 *   Step 1 — Type:         Incoming | Outgoing | Searching (default: Outgoing)
 *   Step 2 — Channel:      Call | Messenger | Mail | Chat  (skipped for Searching)
 *   Step 3 — Contact Type: Client | 3rd Person | Relative  (skipped for Searching;
 *                          auto-set to Relative for Mail/Chat channels)
 *   Step 4 — Result:       filtered by interaction_result_rules for the combination
 *
 * Each step clears all downstream selections when changed.
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
import { DateSelect } from '@/components/ui/DateSelect'
import { toast } from 'sonner'
import {
  useInteractionTypes,
  useInteractionSubtypes,
  useInteractionContactTypes,
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
  subtype_id?: number
  contact_type_id?: number
  result_id?: number
  summary: string
  promise_to_pay_date?: string
  promise_to_pay_amount?: number
  next_action_date?: string
}

// Keep old name as alias for backwards compatibility
export type NoteCreateData = InteractionCreateData

const MAX_NOTE_LENGTH = 2000

// Channel codes that restrict contact type to Relative only
const RELATIVE_ONLY_CHANNELS = new Set(['MAIL', 'CHAT'])

export function AddNoteModal({ open, onClose, phoneNumber, onSave }: AddNoteModalProps) {
  const { t } = useTranslation('common')

  const [typeId, setTypeId] = useState<number | undefined>(undefined)
  const [subtypeId, setSubtypeId] = useState<number | undefined>(undefined)
  const [contactTypeId, setContactTypeId] = useState<number | undefined>(undefined)
  const [resultId, setResultId] = useState<number | undefined>(undefined)
  const [note, setNote] = useState<string>('')
  const [promiseDate, setPromiseDate] = useState<string>('')
  const [promiseAmount, setPromiseAmount] = useState<string>('')
  const [callbackDate, setCallbackDate] = useState<string>('')

  const { data: types, isLoading: isLoadingTypes } = useInteractionTypes()
  const { data: channels, isLoading: isLoadingChannels } = useInteractionSubtypes()
  const { data: contactTypes, isLoading: isLoadingContactTypes } = useInteractionContactTypes()

  const defaultOutgoingTypeId = useMemo(
    () => types?.find((t) => t.code === 'OUTGOING')?.id,
    [types]
  )

  // Default to Outgoing while the modal is open and the user has not chosen another type (no setState in effects).
  const resolvedTypeId =
    typeId !== undefined
      ? typeId
      : open && defaultOutgoingTypeId !== undefined
        ? defaultOutgoingTypeId
        : undefined

  const { data: results, isLoading: isLoadingResults } = useInteractionResults(
    resolvedTypeId !== undefined
      ? { typeId: resolvedTypeId, channelId: subtypeId, contactTypeId }
      : undefined
  )

  // Derived flags from selected lookups
  const selectedType = useMemo(
    () => types?.find((t) => t.id === resolvedTypeId),
    [types, resolvedTypeId]
  )
  const selectedChannel = useMemo(
    () => channels?.find((c) => c.id === subtypeId),
    [channels, subtypeId]
  )
  const selectedResult = useMemo(() => results?.find((r) => r.id === resultId), [results, resultId])

  const isSearching = selectedType?.code === 'SEARCHING'
  const isRelativeOnlyChannel =
    selectedChannel !== undefined && RELATIVE_ONLY_CHANNELS.has(selectedChannel.code)

  // For Mail/Chat: only Relative is valid — hide the dropdown and use the Relative id
  const relativeContactType = useMemo(
    () => contactTypes?.find((ct) => ct.code === 'RELATIVE'),
    [contactTypes]
  )

  const showChannelStep = !isSearching
  const showContactTypeStep = !isSearching && !isRelativeOnlyChannel
  // When Mail/Chat is selected, contact type is fixed to Relative — resolve its id
  const resolvedContactTypeId = isRelativeOnlyChannel ? relativeContactType?.id : contactTypeId

  const showPromiseDate = selectedResult?.requires_promise_date === true
  const showPromiseAmount = selectedResult?.requires_promise_amount === true
  const showCallbackDate = selectedResult?.code === 'callback_by_appointment'

  // --- Step handlers (each clears downstream) ---

  const handleTypeChange = (value: string) => {
    setTypeId(Number(value))
    setSubtypeId(undefined)
    setContactTypeId(undefined)
    setResultId(undefined)
  }

  const handleChannelChange = (value: string) => {
    setSubtypeId(Number(value))
    setContactTypeId(undefined)
    setResultId(undefined)
  }

  const handleContactTypeChange = (value: string) => {
    setContactTypeId(Number(value))
    setResultId(undefined)
  }

  const handleResultChange = (value: string) => {
    setResultId(Number(value))
    setPromiseDate('')
    setPromiseAmount('')
    setCallbackDate('')
  }

  // --- Validation & submit ---

  const handleSave = () => {
    if (!resolvedTypeId) {
      toast.error(t('pages.clients.modals.addNote.selectType', 'Please select a type'))
      return
    }
    if (!isSearching && !subtypeId) {
      toast.error(t('pages.clients.modals.addNote.selectChannel', 'Please select a channel'))
      return
    }
    if (!isSearching && !isRelativeOnlyChannel && !contactTypeId) {
      toast.error(
        t('pages.clients.modals.addNote.selectContactType', 'Please select a contact type')
      )
      return
    }

    const data: InteractionCreateData = {
      type_id: resolvedTypeId,
      subtype_id: isSearching ? undefined : subtypeId,
      contact_type_id: isSearching ? undefined : resolvedContactTypeId,
      result_id: resultId,
      summary: note,
      promise_to_pay_date: showPromiseDate && promiseDate ? promiseDate : undefined,
      promise_to_pay_amount:
        showPromiseAmount && promiseAmount ? parseFloat(promiseAmount) : undefined,
      next_action_date: showCallbackDate && callbackDate ? callbackDate : undefined,
    }

    onSave(data)
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setTypeId(undefined)
    setSubtypeId(undefined)
    setContactTypeId(undefined)
    setResultId(undefined)
    setNote('')
    setPromiseDate('')
    setPromiseAmount('')
    setCallbackDate('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const isLoading = isLoadingTypes || isLoadingChannels || isLoadingContactTypes

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

          {/* Step 1 — Type */}
          <div className="flex flex-col gap-2">
            <label
              className="text-dark-500 text-xs font-light sm:text-sm"
              htmlFor="interaction-type"
            >
              {t('pages.clients.modals.addNote.type', 'Type')}:
            </label>
            {isLoadingTypes ? (
              <div className="text-xs text-gray-500">{t('common.loading', 'Loading...')}</div>
            ) : (
              <Select value={resolvedTypeId?.toString()} onValueChange={handleTypeChange}>
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
                      {t(`interactionTypes.${type.code}`, { defaultValue: type.name })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Step 2 — Communication Channel (hidden for Searching) */}
          {resolvedTypeId !== undefined && showChannelStep && (
            <div className="flex flex-col gap-2">
              <label
                className="text-dark-500 text-xs font-light sm:text-sm"
                htmlFor="interaction-channel"
              >
                {t('pages.clients.modals.addNote.channel', 'Communication channel')}:
              </label>
              {isLoadingChannels ? (
                <div className="text-xs text-gray-500">{t('common.loading', 'Loading...')}</div>
              ) : (
                <Select value={subtypeId?.toString()} onValueChange={handleChannelChange}>
                  <SelectTrigger className="w-full" id="interaction-channel" aria-label="Channel">
                    <SelectValue
                      placeholder={t(
                        'pages.clients.modals.addNote.selectChannel',
                        'Select channel'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {channels?.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id.toString()}>
                        {t(`interactionChannels.${channel.code}`, { defaultValue: channel.name })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Step 3 — Contact Type (hidden for Searching; auto-set for Mail/Chat) */}
          {subtypeId !== undefined && showContactTypeStep && (
            <div className="flex flex-col gap-2">
              <label
                className="text-dark-500 text-xs font-light sm:text-sm"
                htmlFor="interaction-contact-type"
              >
                {t('pages.clients.modals.addNote.contactType', 'Contact type')}:
              </label>
              {isLoadingContactTypes ? (
                <div className="text-xs text-gray-500">{t('common.loading', 'Loading...')}</div>
              ) : (
                <Select value={contactTypeId?.toString()} onValueChange={handleContactTypeChange}>
                  <SelectTrigger
                    className="w-full"
                    id="interaction-contact-type"
                    aria-label="Contact type"
                  >
                    <SelectValue
                      placeholder={t(
                        'pages.clients.modals.addNote.selectContactType',
                        'Select contact type'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {contactTypes?.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id.toString()}>
                        {t(`interactionContactTypes.${ct.code}`, { defaultValue: ct.name })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Step 4 — Result (shown once upstream steps are complete) */}
          {(isSearching
            ? resolvedTypeId !== undefined
            : isRelativeOnlyChannel
              ? subtypeId !== undefined
              : contactTypeId !== undefined) && (
            <div className="flex flex-col gap-2">
              <label
                className="text-dark-500 text-xs font-light sm:text-sm"
                htmlFor="interaction-result"
              >
                {t('pages.clients.modals.addNote.result', 'Result')}:
              </label>
              {isLoadingResults ? (
                <div className="text-xs text-gray-500">{t('common.loading', 'Loading...')}</div>
              ) : (
                <Select value={resultId?.toString()} onValueChange={handleResultChange}>
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
                        {t(`interactionResults.${result.code}`, { defaultValue: result.name })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Promise to Pay Date (conditional on result flag) */}
          {showPromiseDate && (
            <DateSelect
              label={`${t('pages.clients.modals.addNote.promiseDate', 'Promise date')}:`}
              id="promise-date"
              value={promiseDate || null}
              onChange={({ value }) =>
                setPromiseDate(value ? value.toISOString().slice(0, 10) : '')
              }
              placeholder={t('pages.clients.modals.addNote.selectDate', 'Select date')}
              format="dd/MM/yyyy"
            />
          )}

          {/* Promise to Pay Amount (conditional on result flag) */}
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

          {/* Callback Date (conditional on result requires_followup flag) */}
          {showCallbackDate && (
            <DateSelect
              label={`${t('pages.clients.modals.addNote.callbackDate', 'Callback date')}:`}
              id="callback-date"
              value={callbackDate || null}
              onChange={({ value }) =>
                setCallbackDate(value ? value.toISOString().slice(0, 10) : '')
              }
              placeholder={t('pages.clients.modals.addNote.selectDate', 'Select date')}
              format="dd/MM/yyyy"
            />
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
