/**
 * Edit Interaction Modal
 *
 * Pre-populates all fields from the existing interaction and allows editing.
 */

import { startTransition, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { toast } from 'sonner'
import { useInteractionTypes } from '@/features/clients/hooks/useNoteInteraction'
import type { InteractionResponse } from '@/features/clients/api/types'

export interface EditInteractionModalProps {
  open: boolean
  onClose: () => void
  interaction: InteractionResponse | null
  onSave: (data: {
    type_id?: number
    subtype_id?: number
    contact_type_id?: number
    result_id?: number
    summary?: string
    promise_to_pay_date?: string | null
    promise_to_pay_amount?: number | null
    next_action_date?: string | null
  }) => void
  isSaving?: boolean
}

const MAX_NOTE_LENGTH = 2000

export function EditInteractionModal({
  open,
  onClose,
  interaction,
  onSave,
  isSaving = false,
}: EditInteractionModalProps) {
  const { t } = useTranslation('common')

  const [typeId, setTypeId] = useState<number | undefined>(undefined)
  const [note, setNote] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')

  useEffect(() => {
    if (interaction) {
      startTransition(() => {
        setTypeId(interaction.type_id ?? undefined)
        setNote(interaction.summary ?? interaction.notes ?? '')
        setPhoneNumber(interaction.phone_used ?? '')
      })
    }
  }, [interaction])

  const { data: types, isLoading: isLoadingTypes } = useInteractionTypes()

  const handleTypeChange = (value: string) => {
    setTypeId(Number(value))
  }

  const resetToInteraction = () => {
    if (!interaction) return
    setTypeId(interaction.type_id ?? undefined)
    setNote(interaction.summary ?? interaction.notes ?? '')
    setPhoneNumber(interaction.phone_used ?? '')
  }

  const handleSave = () => {
    if (!typeId) {
      toast.error(t('pages.clients.modals.addNote.selectType', 'Please select a type'))
      return
    }
    onSave({
      type_id: typeId,
      summary: note || undefined,
    })
  }

  const handleClose = () => {
    resetToInteraction()
    onClose()
  }

  const isLoading = isLoadingTypes

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
          {phoneNumber ? (
            <div className="bg-primary-200/10 text-dark-500 border-primary-200 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="text-primary-600 text-xs font-semibold tracking-wide uppercase">
                {t('pages.clients.modals.addNote.phone', 'Phone')}:
              </span>
              <span className="font-medium">{phoneNumber}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label className="text-dark-500 text-xs font-light sm:text-sm">
              {t('pages.clients.modals.addNote.type', 'Type')}:
            </label>
            <Select
              value={typeId?.toString()}
              onValueChange={handleTypeChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t('pages.clients.modals.addNote.selectTypeOfAction', 'Select type')}
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
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-dark-500 text-xs font-light sm:text-sm">
              {t('pages.clients.modals.addNote.note', 'Note')}:
            </label>
            <div className="relative">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
                placeholder={t(
                  'pages.clients.modals.addNote.typeYourNoteHere',
                  'Type your note here...'
                )}
                maxLength={MAX_NOTE_LENGTH}
                className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 min-h-[100px] w-full resize-none rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-light placeholder:text-gray-400 focus:ring-2 focus:outline-none sm:min-h-[120px] sm:text-sm"
                disabled={isLoading}
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
