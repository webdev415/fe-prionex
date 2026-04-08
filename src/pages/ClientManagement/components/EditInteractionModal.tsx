/**
 * Edit Interaction Modal
 *
 * Same 4-step sequential form as AddNoteModal:
 *   Step 1 — Type:         Incoming | Outgoing | Searching
 *   Step 2 — Channel:      Call | Messenger | Mail | Chat  (skipped for Searching)
 *   Step 3 — Contact Type: Client | 3rd Person | Relative  (skipped for Searching;
 *                          auto-set to Relative for Mail/Chat channels)
 *   Step 4 — Result:       filtered by interaction_result_rules for the combination
 *
 * Pre-populates all fields from the existing interaction.
 */

import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getDateTimeStringInTimezone } from '@/lib/dateUtils'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { DateSelect } from '@/components/ui/DateSelect'
import { toast } from 'sonner'
import {
  useInteractionTypes,
  useInteractionSubtypes,
  useInteractionContactTypes,
  useInteractionResults,
} from '@/features/clients/hooks/useNoteInteraction'
import type { InteractionResponse } from '@/features/clients/api/types'

export interface EditInteractionModalProps {
  open: boolean
  onClose: () => void
  interaction: InteractionResponse | null
  loanOptions?: Array<{ id: number; contractNumber: string }>
  onSave: (data: {
    debt_id?: number | null
    type_id?: number
    subtype_id?: number | null
    contact_type_id?: number | null
    result_id?: number | null
    summary?: string
    promise_to_pay_date?: string | null
    promise_to_pay_amount?: number | null
    next_action_date?: string | null
  }) => void
  isSaving?: boolean
}

const MAX_NOTE_LENGTH = 2000

// Channel codes that restrict contact type to Relative only
const RELATIVE_ONLY_CHANNELS = new Set(['MAIL', 'CHAT'])

export function EditInteractionModal({
  open,
  onClose,
  interaction,
  loanOptions = [],
  onSave,
  isSaving = false,
}: EditInteractionModalProps) {
  const { t } = useTranslation('common')

  const [typeId, setTypeId] = useState<number | undefined>(undefined)
  const [subtypeId, setSubtypeId] = useState<number | undefined>(undefined)
  const [contactTypeId, setContactTypeId] = useState<number | undefined>(undefined)
  const [resultId, setResultId] = useState<number | undefined>(undefined)
  const [debtId, setDebtId] = useState<number | undefined>(undefined)
  const [note, setNote] = useState('')
  const [promiseDate, setPromiseDate] = useState<string>('')
  const [promiseAmount, setPromiseAmount] = useState<string>('')
  const [callbackDate, setCallbackDate] = useState<string>('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [initialized, setInitialized] = useState(false)

  const { data: types, isLoading: isLoadingTypes } = useInteractionTypes()
  const { data: channels, isLoading: isLoadingChannels } = useInteractionSubtypes()
  const { data: contactTypes, isLoading: isLoadingContactTypes } = useInteractionContactTypes()
  const { data: results, isLoading: isLoadingResults } = useInteractionResults(
    typeId !== undefined ? { typeId, channelId: subtypeId, contactTypeId } : undefined
  )

  // Pre-populate non-lookup fields immediately when interaction changes
  useEffect(() => {
    if (!interaction) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNote(interaction.summary ?? interaction.notes ?? '')
    setPhoneNumber(interaction.phone_used ?? '')
    setPromiseDate(interaction.promise_to_pay_date ?? '')
    setPromiseAmount(
      interaction.promise_to_pay_amount != null ? String(interaction.promise_to_pay_amount) : ''
    )
    setCallbackDate(interaction.next_action_date ?? '')
    setDebtId(interaction.debt_id ?? undefined)
  }, [interaction])

  // Pre-populate lookup-dependent fields once ALL lookup data is loaded
  useEffect(() => {
    if (!interaction || !types || !channels || !contactTypes) return
    if (initialized) return

    // Legacy Russian name → new code mapping
    const LEGACY_TYPE_MAP: Record<string, string> = {
      исходящий: 'OUTGOING',
      входящий: 'INCOMING',
      розыск: 'SEARCHING',
    }
    const LEGACY_CHANNEL_MAP: Record<string, string> = {
      другое: 'CALL',
      'другое ': 'CALL',
      звонок: 'CALL',
      мессенджер: 'MESSENGER',
      почта: 'MAIL',
      чат: 'CHAT',
      отключён: 'CALL',
      отключен: 'CALL',
    }

    // Match lookup item by: exact id → exact code → legacy name mapping → partial name match
    function matchLookup<T extends { id: number; code: string; name: string }>(
      items: T[],
      id: number | null | undefined,
      code: string | null | undefined,
      name: string | null | undefined,
      legacyMap?: Record<string, string>
    ): number | undefined {
      if (id != null) {
        const byId = items.find((item) => item.id === id)
        if (byId) return byId.id
      }
      if (code) {
        const byCode = items.find((item) => item.code === code)
        if (byCode) return byCode.id
      }
      if (name && legacyMap) {
        const nameLower = name.toLowerCase()
        for (const [legacyKey, newCode] of Object.entries(legacyMap)) {
          if (nameLower.includes(legacyKey)) {
            const byLegacy = items.find((item) => item.code === newCode)
            if (byLegacy) return byLegacy.id
          }
        }
      }
      if (name) {
        const nameLower = name.toLowerCase()
        const byName = items.find((item) => nameLower.includes(item.name.toLowerCase()))
        if (byName) return byName.id
      }
      return undefined
    }

    const matchedTypeId = matchLookup(
      types,
      interaction.type_id,
      interaction.type_code,
      interaction.type_name,
      LEGACY_TYPE_MAP
    )
    const matchedSubtypeId = matchLookup(
      channels,
      interaction.subtype_id,
      interaction.subtype_code,
      interaction.subtype_name,
      LEGACY_CHANNEL_MAP
    )
    const matchedContactTypeId = matchLookup(
      contactTypes,
      interaction.contact_type_id,
      interaction.contact_type_code,
      interaction.contact_type_name
    )

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTypeId(matchedTypeId)
    setSubtypeId(matchedSubtypeId)
    setContactTypeId(matchedContactTypeId)
    setResultId(undefined)
    setInitialized(true)
  }, [interaction, types, channels, contactTypes, initialized])

  // Merge active results with the interaction's current result (may be inactive/hidden)
  const effectiveResults = useMemo(() => {
    if (!results) return undefined
    if (!interaction?.result_id) return results
    if (results.some((r) => r.id === interaction.result_id)) return results
    // The interaction's result is not in the active list — include it as a legacy entry
    const isAgreementLike =
      interaction.result_code === 'agreement' ||
      (interaction.result_code?.startsWith('agreement_') ?? false)
    return [
      {
        id: interaction.result_id,
        code: interaction.result_code ?? '',
        name: interaction.result_name ?? 'Unknown',
        requires_followup: false,
        is_active: false,
        sort_order: -1,
        requires_promise_date: isAgreementLike,
        requires_promise_amount: isAgreementLike,
        creates_task: null,
        is_positive: interaction.result_is_positive ?? null,
        positive_score: null,
        negative_score: null,
      },
      ...results,
    ]
  }, [results, interaction])

  // Set resultId once results list is loaded (only if it matches)
  const [resultInitialized, setResultInitialized] = useState(false)
  useEffect(() => {
    if (!interaction || !effectiveResults || resultInitialized) return
    const matched = effectiveResults.find((r) => r.id === interaction.result_id)
    if (matched) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResultId(matched.id)
    }
    setResultInitialized(true)
  }, [interaction, effectiveResults, resultInitialized])

  // Reset initialized flags when interaction changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialized(false)
    setResultInitialized(false)
  }, [interaction?.id])

  // Derived flags from selected lookups
  const selectedType = useMemo(() => types?.find((t) => t.id === typeId), [types, typeId])
  const selectedChannel = useMemo(
    () => channels?.find((c) => c.id === subtypeId),
    [channels, subtypeId]
  )
  const selectedResult = useMemo(
    () => effectiveResults?.find((r) => r.id === resultId),
    [effectiveResults, resultId]
  )

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
  const resolvedContactTypeId = isRelativeOnlyChannel ? relativeContactType?.id : contactTypeId

  const showPromiseDate = selectedResult?.requires_promise_date === true
  const showPromiseAmount = selectedResult?.requires_promise_amount === true
  const showCallbackDate = selectedResult?.code === 'callback_by_appointment'
  const showCreditNumberField =
    selectedResult?.code === 'agreement_full_payment' ||
    selectedResult?.code === 'agreement_partial_payment' ||
    selectedResult?.code === 'agreement_restructuring' ||
    selectedResult?.code === 'agreement_potential_payment'

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
    setDebtId(undefined)
    setPromiseDate('')
    setPromiseAmount('')
    setCallbackDate('')
    setNote('')
  }

  // --- Validation & submit ---

  const handleSave = () => {
    if (!typeId) {
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

    if (showCallbackDate && !callbackDate) {
      toast.error(
        t('pages.clients.modals.addNote.callbackDateRequired', 'Callback date is required')
      )
      return
    }
    if (showCallbackDate && callbackDate && new Date(callbackDate) <= new Date()) {
      toast.error(
        t(
          'pages.clients.modals.addNote.callbackDateFuture',
          'Callback date must be later than the current time'
        )
      )
      return
    }
    if (showPromiseDate && !promiseDate) {
      toast.error(t('pages.clients.modals.addNote.promiseDateRequired', 'Promise date is required'))
      return
    }
    if (showPromiseDate && promiseDate && new Date(promiseDate) <= new Date()) {
      toast.error(
        t(
          'pages.clients.modals.addNote.promiseDateFuture',
          'Promise date must be later than the current time'
        )
      )
      return
    }
    if (showPromiseAmount && (!promiseAmount || parseFloat(promiseAmount) <= 0)) {
      toast.error(
        t(
          'pages.clients.modals.addNote.promiseAmountPositive',
          'Promise amount must be greater than 0'
        )
      )
      return
    }
    if (showCreditNumberField && !debtId) {
      toast.error(
        t('pages.clients.modals.addNote.selectCreditNumber', 'Please select a credit number')
      )
      return
    }

    onSave({
      debt_id: showCreditNumberField ? debtId : null,
      type_id: typeId,
      subtype_id: isSearching ? null : subtypeId,
      contact_type_id: isSearching ? null : resolvedContactTypeId,
      result_id: resultId ?? null,
      summary: note || undefined,
      promise_to_pay_date: showPromiseDate && promiseDate ? promiseDate : null,
      promise_to_pay_amount: showPromiseAmount && promiseAmount ? parseFloat(promiseAmount) : null,
      next_action_date: showCallbackDate && callbackDate ? callbackDate : null,
    })
  }

  const resetToInteraction = () => {
    setTypeId(undefined)
    setSubtypeId(undefined)
    setContactTypeId(undefined)
    setResultId(undefined)
    setDebtId(undefined)
    setNote('')
    setPromiseDate('')
    setPromiseAmount('')
    setCallbackDate('')
    setPhoneNumber('')
    setInitialized(false)
    setResultInitialized(false)
  }

  const handleClose = () => {
    resetToInteraction()
    onClose()
  }

  // Safe Select values — only pass value if it exists in the list (prevents Radix crash)
  const safeTypeValue =
    typeId != null && types?.some((t) => t.id === typeId) ? typeId.toString() : undefined
  const safeSubtypeValue =
    subtypeId != null && channels?.some((c) => c.id === subtypeId)
      ? subtypeId.toString()
      : undefined
  const safeContactTypeValue =
    contactTypeId != null && contactTypes?.some((ct) => ct.id === contactTypeId)
      ? contactTypeId.toString()
      : undefined
  const safeResultValue =
    resultId != null && effectiveResults?.some((r) => r.id === resultId)
      ? resultId.toString()
      : undefined

  const isLoading = isLoadingTypes || isLoadingChannels || isLoadingContactTypes

  return (
    <Modal open={open} onClose={handleClose} maxWidth="xl">
      <ModalHeader
        onClose={handleClose}
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
            <Icons.PencilEdit size={20} className="text-dark-500 sm:size-6" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.modals.editInteraction.title', 'Edit Interaction')}
      />
      <ModalContent>
        <div className="flex flex-col gap-4 md:gap-6">
          {/* Phone Field */}
          {phoneNumber ? (
            <div className="flex flex-row items-center gap-2 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-dark-500 text-xs font-light sm:text-sm">
                  {t('pages.clients.modals.addNote.phone', 'Phone')}:
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
          ) : null}

          {/* Step 1 — Type */}
          <div className="flex flex-col gap-2">
            <label
              className="text-dark-500 text-xs font-light sm:text-sm"
              htmlFor="edit-interaction-type"
            >
              {t('pages.clients.modals.addNote.type', 'Type')}:
            </label>
            {isLoadingTypes ? (
              <div className="text-xs text-gray-500">{t('common.loading', 'Loading...')}</div>
            ) : (
              <Select value={safeTypeValue} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-full" id="edit-interaction-type" aria-label="Type">
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
          {typeId !== undefined && showChannelStep && (
            <div className="flex flex-col gap-2">
              <label
                className="text-dark-500 text-xs font-light sm:text-sm"
                htmlFor="edit-interaction-channel"
              >
                {t('pages.clients.modals.addNote.channel', 'Communication channel')}:
              </label>
              {isLoadingChannels ? (
                <div className="text-xs text-gray-500">{t('common.loading', 'Loading...')}</div>
              ) : (
                <Select value={safeSubtypeValue} onValueChange={handleChannelChange}>
                  <SelectTrigger
                    className="w-full"
                    id="edit-interaction-channel"
                    aria-label="Channel"
                  >
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
                htmlFor="edit-interaction-contact-type"
              >
                {t('pages.clients.modals.addNote.contactType', 'Contact type')}:
              </label>
              {isLoadingContactTypes ? (
                <div className="text-xs text-gray-500">{t('common.loading', 'Loading...')}</div>
              ) : (
                <Select value={safeContactTypeValue} onValueChange={handleContactTypeChange}>
                  <SelectTrigger
                    className="w-full"
                    id="edit-interaction-contact-type"
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
            ? typeId !== undefined
            : isRelativeOnlyChannel
              ? subtypeId !== undefined
              : contactTypeId !== undefined) && (
            <div className="flex flex-col gap-2">
              <label
                className="text-dark-500 text-xs font-light sm:text-sm"
                htmlFor="edit-interaction-result"
              >
                {t('pages.clients.modals.addNote.result', 'Result')}:
              </label>
              {isLoadingResults ? (
                <div className="text-xs text-gray-500">{t('common.loading', 'Loading...')}</div>
              ) : (
                <Select value={safeResultValue} onValueChange={handleResultChange}>
                  <SelectTrigger
                    className="w-full"
                    id="edit-interaction-result"
                    aria-label="Result"
                  >
                    <SelectValue
                      placeholder={t(
                        'pages.clients.modals.addNote.selectResult',
                        'Select result (optional)'
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const agreementResults =
                        effectiveResults?.filter(
                          (r) => r.code === 'agreement' || r.code.startsWith('agreement_')
                        ) ?? []
                      const otherResults =
                        effectiveResults?.filter(
                          (r) => r.code !== 'agreement' && !r.code.startsWith('agreement_')
                        ) ?? []

                      return (
                        <>
                          {agreementResults.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-xs font-semibold text-gray-500">
                                {t('interactionResults.agreementGroup', 'Agreement')}
                              </SelectLabel>
                              {agreementResults.map((result) => (
                                <SelectItem key={result.id} value={result.id.toString()}>
                                  {t(`interactionResults.${result.code}`, {
                                    defaultValue: result.name,
                                  })}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {agreementResults.length > 0 && otherResults.length > 0 && (
                            <SelectSeparator />
                          )}
                          {otherResults.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-xs font-semibold text-gray-500">
                                {t('interactionResults.otherGroup', 'Other')}
                              </SelectLabel>
                              {otherResults.map((result) => (
                                <SelectItem key={result.id} value={result.id.toString()}>
                                  {t(`interactionResults.${result.code}`, {
                                    defaultValue: result.name,
                                  })}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </>
                      )
                    })()}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Credit Number (shown for Agreement - * results only) */}
          {showCreditNumberField && (
            <div className="flex flex-col gap-2">
              <label
                className="text-dark-500 text-xs font-light sm:text-sm"
                htmlFor="edit-interaction-credit-number"
              >
                {t('pages.clients.modals.addNote.creditNumber', 'Credit number')}:
              </label>
              <Select
                value={debtId?.toString()}
                onValueChange={(value) => setDebtId(Number(value))}
              >
                <SelectTrigger
                  className="w-full"
                  id="edit-interaction-credit-number"
                  aria-label="Credit number"
                >
                  <SelectValue
                    placeholder={t(
                      'pages.clients.modals.addNote.selectCreditNumber',
                      'Select credit number'
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {loanOptions.map((loan) => (
                    <SelectItem key={loan.id} value={loan.id.toString()}>
                      {loan.contractNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Promise to Pay Date (conditional on result flag) */}
          {showPromiseDate && (
            <DateSelect
              label={`${t('pages.clients.modals.addNote.promiseDate', 'Promise date')}:`}
              id="edit-promise-date"
              value={promiseDate || null}
              onChange={({ value }) =>
                setPromiseDate(value ? getDateTimeStringInTimezone(value) : '')
              }
              placeholder={t('pages.clients.modals.addNote.selectDate', 'Select date')}
              format="dd/MM/yyyy HH:mm"
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
            />
          )}

          {/* Promise to Pay Amount (conditional on result flag) */}
          {showPromiseAmount && (
            <div className="flex flex-col gap-2">
              <label
                className="text-dark-500 text-xs font-light sm:text-sm"
                htmlFor="edit-promise-amount"
              >
                {t('pages.clients.modals.addNote.promiseAmount', 'Promise amount')}:
              </label>
              <input
                type="number"
                id="edit-promise-amount"
                value={promiseAmount}
                onChange={(e) => setPromiseAmount(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-light placeholder:text-gray-400 focus:ring-2 focus:outline-none sm:text-sm"
              />
            </div>
          )}

          {/* Callback Date (conditional on result code) */}
          {showCallbackDate && (
            <DateSelect
              label={`${t('pages.clients.modals.addNote.callbackDate', 'Callback date')}:`}
              id="edit-callback-date"
              value={callbackDate || null}
              onChange={({ value }) =>
                setCallbackDate(value ? getDateTimeStringInTimezone(value) : '')
              }
              placeholder={t('pages.clients.modals.addNote.selectDate', 'Select date')}
              format="dd/MM/yyyy HH:mm"
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
            />
          )}

          {/* Note / Comment */}
          <div className="flex flex-col gap-2">
            <label className="text-dark-500 text-xs font-light sm:text-sm">
              {t('pages.clients.modals.addNote.note', 'Note')}:
            </label>
            <div className="relative">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t(
                  'pages.clients.modals.addNote.typeYourNoteHere',
                  'Type your note here...'
                )}
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
        <Button
          variant="cancel"
          size="sm"
          onClick={handleClose}
          className="w-full rounded-md"
          disabled={isSaving}
        >
          {t('actions.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="w-full rounded-md"
        >
          {isSaving ? t('actions.saving', 'Saving…') : t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default EditInteractionModal
