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
import { Textarea } from '@/components/ui/Textarea'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig, SettingsReplyTemplate } from '../../../settings/types'
import { LetterTypeBadge } from '../LetterTypeBadge'

export interface ReplyTemplateFormValues {
  name: string
  body: string
  letterTypeIds: string[]
  isActive: boolean
}

interface ReplyTemplateModalProps {
  open: boolean
  template: SettingsReplyTemplate | null
  letterTypes: LetterTypeConfig[]
  onClose: () => void
  onSave: (values: ReplyTemplateFormValues) => void | Promise<void>
  isSubmitting?: boolean
}

function getInitialValues(
  template: SettingsReplyTemplate | null,
  t: (key: string, fallback: string) => string
): ReplyTemplateFormValues {
  if (!template) {
    return { name: '', body: '', letterTypeIds: [], isActive: true }
  }
  return {
    name: t(template.nameKey, template.nameFallback),
    body: t(template.bodyKey, template.bodyFallback),
    letterTypeIds: [...template.letterTypeIds],
    isActive: template.isActive,
  }
}

export function ReplyTemplateModal({
  open,
  template,
  letterTypes,
  onClose,
  onSave,
  isSubmitting = false,
}: ReplyTemplateModalProps) {
  const { t } = useTranslation('common')
  const isEditing = template !== null

  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [letterTypeIds, setLetterTypeIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)
  const [typesOpen, setTypesOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const initial = getInitialValues(template, t)
      setName(initial.name)
      setBody(initial.body)
      setLetterTypeIds(initial.letterTypeIds)
      setIsActive(initial.isActive)
      setTypesOpen(false)
    })
  }, [open, template, t])

  const toggleType = (typeId: string) => {
    setLetterTypeIds((previous) =>
      previous.includes(typeId) ? previous.filter((id) => id !== typeId) : [...previous, typeId]
    )
  }

  const canSave = name.trim().length > 0 && body.trim().length > 0

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.File size={20} strokeWidth={1.5} className="text-dark-500" />
          </div>
        }
        title={
          isEditing
            ? t('pages.lawyerWorkplace.settings.templates.editReplyTitle', 'Edit reply template')
            : t('pages.lawyerWorkplace.settings.templates.addReplyTitle', 'Add reply template')
        }
      />
      <ModalContent className="flex flex-col gap-5 px-1">
        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.templates.fields.name', 'Template name')}
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
            {t('pages.lawyerWorkplace.settings.templates.fields.letterTypes', 'Letter types')}
          </Label>
          <DropdownMenu open={typesOpen} onOpenChange={setTypesOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex min-h-11 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-2 text-[14px]"
              >
                <span className="flex flex-wrap gap-1.5 text-left">
                  {letterTypeIds.length === 0 ? (
                    <span className="text-gray-400">
                      {t('pages.lawyerWorkplace.settings.templates.allTypes', 'All types')}
                    </span>
                  ) : (
                    letterTypeIds.map((typeId) => {
                      const letterType = letterTypes.find((item) => item.id === typeId)
                      if (!letterType) return null
                      return (
                        <LetterTypeBadge key={typeId} letterType={letterType} t={t} size="sm" />
                      )
                    })
                  )}
                </span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-60 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1.5"
            >
              {letterTypes.map((type) => (
                <DropdownMenuItem
                  key={type.id}
                  className="cursor-pointer"
                  onClick={() => toggleType(type.id)}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <LetterTypeBadge letterType={type} t={t} size="sm" />
                    {letterTypeIds.includes(type.id) ? (
                      <Icons.Tick02 size={14} strokeWidth={2} className="text-secondary-800" />
                    ) : null}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.templates.fields.body', 'Template body')}
          </Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder={t(
              'pages.lawyerWorkplace.settings.templates.fields.bodyPlaceholder',
              'Write the reply template text...'
            )}
            className="text-dark-500 min-h-[160px] resize-y rounded-md border-gray-200 text-[13px]"
          />
          <p className="text-light-600 text-[11px]">
            {t(
              'pages.lawyerWorkplace.settings.templates.fields.bodyHint',
              'Placeholders like {{clientName}} and {{referenceId}} are supported.'
            )}
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-secondary-800 h-4 w-4 rounded border-gray-300"
          />
          <span className={cn('text-dark-500 text-[13px]')}>
            {t(
              'pages.lawyerWorkplace.settings.templates.fields.active',
              'Active in reply composer'
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
              body: body.trim(),
              letterTypeIds,
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
