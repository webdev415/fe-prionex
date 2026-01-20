/**
 * Add Note Modal Component
 *
 * Reusable modal for adding notes about clients.
 * Includes phone display, action/type dropdowns, and note textarea with character counter.
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

export interface AddNoteModalProps {
  open: boolean
  onClose: () => void
  phoneNumber: string
  onSave: (data: { action: string; type: string; note: string }) => void
}

// Action options will be translated using translation keys
const ACTION_OPTION_KEYS = [
  'incomingCall',
  'outgoingCall',
  'fieldVisit',
  'outgoingCallInDepth',
  'outgoingCallSurface',
] as const

const MAX_NOTE_LENGTH = 2000

export function AddNoteModal({ open, onClose, phoneNumber, onSave }: AddNoteModalProps) {
  const { t } = useTranslation('common')
  const [action, setAction] = useState<string>('')
  const [type, setType] = useState<string>('')
  const [note, setNote] = useState<string>('')

  const handleSave = () => {
    if (!action || !note.trim()) {
      // TODO: Show validation error
      return
    }
    onSave({ action, type, note })
    // Reset form
    setAction('')
    setType('')
    setNote('')
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setAction('')
    setType('')
    setNote('')
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

          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Action Dropdown */}
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-dark-500 text-xs font-light sm:text-sm">
                {t('pages.clients.modals.addNote.action')}:
              </label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('pages.clients.modals.addNote.selectAction')} />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTION_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`pages.clients.modals.addNote.actionOptions.${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Dropdown */}
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-dark-500 text-xs font-light sm:text-sm">
                {t('pages.clients.modals.addNote.type')}:
              </label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('pages.clients.modals.addNote.selectTypeOfAction')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="type1">{t('pages.clients.modals.addNote.type1')}</SelectItem>
                  <SelectItem value="type2">{t('pages.clients.modals.addNote.type2')}</SelectItem>
                  <SelectItem value="type3">{t('pages.clients.modals.addNote.type3')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
