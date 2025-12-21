/**
 * Add Note Modal Component
 *
 * Reusable modal for adding notes about clients.
 * Includes phone display, action/type dropdowns, and note textarea with character counter.
 */

import { useState } from 'react'
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

const ACTION_OPTIONS = [
  'Incoming call',
  'Outgoing call',
  'Field visit',
  'Outgoing call. In-depth processing of the contract by the operator',
  'Outgoing call. Surface processing of the contract by the operator',
]

const MAX_NOTE_LENGTH = 2000

export function AddNoteModal({ open, onClose, phoneNumber, onSave }: AddNoteModalProps) {
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
          <div className="bg-primary-300 flex h-12 w-12 items-center justify-center rounded-full">
            <Icons.PencilEdit size={24} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title="Add Note"
      />
      <ModalContent>
        <div className="flex flex-col gap-6">
          {/* Phone Field */}
          <div className="flex items-center gap-3">
            <span className="text-dark-500 text-sm font-light">Phone:</span>
            <span className="text-dark-500 text-sm font-light">{phoneNumber}</span>
            <button className="bg-primary-300 flex items-center gap-1 rounded-full px-3 py-1.5">
              <Icons.Headset size={16} className="text-dark-500" strokeWidth={1.5} />
              <span className="text-dark-500 text-xs font-medium">Call</span>
            </button>
          </div>

          <div className="flex flex-row items-center gap-6">
            {/* Action Dropdown */}
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-dark-500 text-sm font-light">Action:</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Dropdown */}
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-dark-500 text-sm font-light">Type:</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type of action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="type1">Type 1</SelectItem>
                  <SelectItem value="type2">Type 2</SelectItem>
                  <SelectItem value="type3">Type 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Note Textarea */}
          <div className="flex flex-col gap-2">
            <label className="text-dark-500 text-sm font-light">Note:</label>
            <div className="relative">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Type your note here"
                maxLength={MAX_NOTE_LENGTH}
                className="text-dark-500 focus:ring-primary-300/20 focus:border-primary-300 min-h-[120px] w-full resize-none rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-light placeholder:text-gray-400 focus:ring-2 focus:outline-none"
              />
              <div className="absolute right-2 bottom-2 text-xs font-light text-gray-400">
                {note.length}/{MAX_NOTE_LENGTH}
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          variant="outline"
          size="md"
          onClick={handleClose}
          className="text-dark-500 border-gray-400 bg-white hover:bg-gray-50"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          className="bg-primary-300 text-dark-500 hover:bg-primary-400"
        >
          Save
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default AddNoteModal
