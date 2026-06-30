import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Label } from '@/components/ui/Label'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type {
  DocumentPresetType,
  SettingsDocumentPreset,
  SettingsLawyer,
} from '../../../settings/types'
import { DOCUMENT_PRESET_TYPE_OPTIONS } from '../constants'

export interface DocumentPresetFormValues {
  name: string
  documentType: DocumentPresetType
  defaultAssigneeId: string | null
  isActive: boolean
}

interface DocumentPresetModalProps {
  open: boolean
  preset: SettingsDocumentPreset | null
  lawyerAssignees: SettingsLawyer[]
  onClose: () => void
  onSave: (values: DocumentPresetFormValues) => void | Promise<void>
  isSubmitting?: boolean
}

function getInitialValues(
  preset: SettingsDocumentPreset | null,
  lawyerAssignees: SettingsLawyer[],
  t: (key: string, fallback: string) => string
): DocumentPresetFormValues {
  if (!preset) {
    return {
      name: '',
      documentType: 'outgoing',
      defaultAssigneeId: lawyerAssignees[0]?.id ?? null,
      isActive: true,
    }
  }
  return {
    name: t(preset.nameKey, preset.nameFallback),
    documentType: preset.documentType,
    defaultAssigneeId: preset.defaultAssigneeId,
    isActive: preset.isActive,
  }
}

export function DocumentPresetModal({
  open,
  preset,
  lawyerAssignees,
  onClose,
  onSave,
  isSubmitting = false,
}: DocumentPresetModalProps) {
  const { t } = useTranslation('common')
  const isEditing = preset !== null

  const [name, setName] = useState('')
  const [documentType, setDocumentType] = useState<DocumentPresetType>('outgoing')
  const [defaultAssigneeId, setDefaultAssigneeId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const initial = getInitialValues(preset, lawyerAssignees, t)
      setName(initial.name)
      setDocumentType(initial.documentType)
      setDefaultAssigneeId(initial.defaultAssigneeId)
      setIsActive(initial.isActive)
    })
  }, [open, preset, t, lawyerAssignees])

  const selectedType =
    DOCUMENT_PRESET_TYPE_OPTIONS.find((option) => option.id === documentType) ??
    DOCUMENT_PRESET_TYPE_OPTIONS[0]!
  const selectedAssignee = lawyerAssignees.find((lawyer) => lawyer.id === defaultAssigneeId)

  const canSave = name.trim().length > 0

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.File size={20} strokeWidth={1.5} className="text-dark-500" />
          </div>
        }
        title={
          isEditing
            ? t('pages.lawyerWorkplace.settings.templates.editPresetTitle', 'Edit document preset')
            : t('pages.lawyerWorkplace.settings.templates.addPresetTitle', 'Add document preset')
        }
      />
      <ModalContent className="flex flex-col gap-5 px-1">
        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.templates.fields.name', 'Preset name')}
          </Label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-dark-500 focus:border-primary-400 h-11 rounded-md border border-gray-200 bg-white px-4 text-[14px] outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.templates.fields.documentType', 'Document type')}
          </Label>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex h-11 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-4 text-[14px]"
              >
                <span className="flex items-center gap-2">
                  <span className="bg-light-100 rounded-full px-2 py-0.5 text-[10px] font-medium">
                    {selectedType.badge}
                  </span>
                  {t(selectedType.labelKey, selectedType.fallback)}
                </span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-60 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1.5"
            >
              {DOCUMENT_PRESET_TYPE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  className="cursor-pointer"
                  onClick={() => setDocumentType(option.id)}
                >
                  {t(option.labelKey, option.fallback)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.templates.fields.assignee', 'Default assignee')}
          </Label>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex h-11 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-4 text-[14px]"
              >
                <span className={cn(!selectedAssignee && 'text-gray-400')}>
                  {selectedAssignee
                    ? t(selectedAssignee.nameKey, selectedAssignee.nameFallback)
                    : t('pages.lawyerWorkplace.settings.templates.noAssignee', '—')}
                </span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-60 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1.5"
            >
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setDefaultAssigneeId(null)}
              >
                {t('pages.lawyerWorkplace.settings.templates.noAssignee', '—')}
              </DropdownMenuItem>
              {lawyerAssignees.map((lawyer) => (
                <DropdownMenuItem
                  key={lawyer.id}
                  className="cursor-pointer"
                  onClick={() => setDefaultAssigneeId(lawyer.id)}
                >
                  {t(lawyer.nameKey, lawyer.nameFallback)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-secondary-800 h-4 w-4 rounded border-gray-300"
          />
          <span className="text-dark-500 text-[13px]">
            {t(
              'pages.lawyerWorkplace.settings.templates.fields.presetActive',
              'Active in document generation'
            )}
          </span>
        </label>
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" onClick={onClose} className="h-10 w-full rounded-md">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={!canSave || isSubmitting}
          onClick={() =>
            void onSave({
              name: name.trim(),
              documentType,
              defaultAssigneeId,
              isActive,
            })
          }
          className="h-10 w-full rounded-md"
        >
          {isEditing ? t('actions.save', 'Save') : t('actions.add', 'Add')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
