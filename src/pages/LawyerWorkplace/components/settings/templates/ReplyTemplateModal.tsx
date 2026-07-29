import { useEffect, useMemo, useRef, useState } from 'react'
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
import { insertMessagingVariableAtCursor } from '@/features/messaging/utils/messagingTemplateVariables'
import {
  fillTemplateVariables,
  type LegalTemplateFillContext,
} from '@/features/lawyerWorkplace/utils/letterTemplateVariables'
import { Icons } from '@/lib/icons'
import type { LetterTypeConfig, SettingsReplyTemplate } from '../../../settings/types'
import { LetterTypeBadge } from '../LetterTypeBadge'
import { LegalLetterVariablesPalette } from './LegalLetterVariablesPalette'

export interface ReplyTemplateFormValues {
  name: string
  body: string
  letterTypeIds: string[]
}

/** Sample values used only for the in-editor live preview of the template body. */
const TEMPLATE_PREVIEW_DEMO_CONTEXT: LegalTemplateFillContext = {
  clientName: 'Іваненко Іван Іванович',
  clientTaxId: '1234567890',
  contract: 'CR-2024-00518',
  debtAmount: '12 500,00 грн',
  senderName: 'Національний банк України',
  incomingRef: '12-3456',
  incomingDate: '01.07.2026',
  caseNo: '910/456/24',
  requestNo: 'ВХ-0042',
  outNo: 'ВИХ-0128',
  date: '30.07.2026',
  dueDate: '15.08.2026',
  lawyerName: 'Петренко О. В.',
  attachments: 'Копія договору, розрахунок заборгованості',
  companyName: 'ТОВ «ФК «ТЕХНОФІНАНС»',
  companyPhone: '+380 44 000 00 00',
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
    return { name: '', body: '', letterTypeIds: [] }
  }
  return {
    name: t(template.nameKey, template.nameFallback),
    body: t(template.bodyKey, template.bodyFallback),
    letterTypeIds: [...template.letterTypeIds],
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
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [letterTypeIds, setLetterTypeIds] = useState<string[]>([])
  const [typesOpen, setTypesOpen] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const initial = getInitialValues(template, t)
      setName(initial.name)
      setBody(initial.body)
      setLetterTypeIds(initial.letterTypeIds)
      setTypesOpen(false)
      setShowPreview(false)
    })
  }, [open, template, t])

  const previewText = useMemo(
    () => fillTemplateVariables(body, TEMPLATE_PREVIEW_DEMO_CONTEXT),
    [body]
  )

  const toggleType = (typeId: string) => {
    setLetterTypeIds((previous) =>
      previous.includes(typeId) ? previous.filter((id) => id !== typeId) : [...previous, typeId]
    )
  }

  const insertVariableAtCursor = (variableName: string) => {
    insertMessagingVariableAtCursor({
      variableName,
      subject: '',
      body,
      setSubject: () => {},
      setBody,
      showSubject: false,
      subjectRef: { current: null },
      bodyRef,
      lastFocusedRef: { current: 'body' },
    })
  }

  const canSave = name.trim().length > 0 && body.trim().length > 0

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.File size={20} strokeWidth={1.5} className="text-foreground" />
          </div>
        }
        title={
          isEditing
            ? t('pages.lawyerWorkplace.settings.templates.editReplyTitle', 'Edit letter template')
            : t('pages.lawyerWorkplace.settings.templates.addReplyTitle', 'Add letter template')
        }
      />
      <ModalContent className="flex flex-col gap-5 px-1">
        <div className="flex flex-col gap-2">
          <Label className="text-foreground text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.templates.fields.name', 'Template name')}
          </Label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-foreground focus:border-primary-400 border-border bg-input h-11 rounded-md border px-4 text-[14px] outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-foreground text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.templates.fields.letterTypes', 'Letter types')}
          </Label>
          <DropdownMenu open={typesOpen} onOpenChange={setTypesOpen} modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-foreground border-border bg-input flex min-h-11 w-full items-center justify-between rounded-md border px-4 py-2 text-[14px]"
              >
                <span className="flex flex-wrap gap-1.5 text-left">
                  {letterTypeIds.length === 0 ? (
                    <span className="text-muted-foreground">
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
                <Icons.ArrowDown
                  size={16}
                  strokeWidth={1.5}
                  className="text-muted-foreground shrink-0"
                />
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
          <Label className="text-foreground text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.templates.fields.body', 'Template body')}
          </Label>
          <Textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder={t(
              'pages.lawyerWorkplace.settings.templates.fields.bodyPlaceholder',
              'Write the letter template text...'
            )}
            className="text-foreground border-border min-h-[160px] resize-y rounded-md text-[13px]"
          />
        </div>

        <LegalLetterVariablesPalette onInsert={insertVariableAtCursor} disabled={isSubmitting} />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((previous) => !previous)}
            className="text-secondary-800 hover:text-secondary-700 flex w-fit items-center gap-1.5 text-[13px] font-medium"
          >
            <Icons.Eye size={15} strokeWidth={1.5} />
            {showPreview
              ? t('pages.lawyerWorkplace.settings.templates.previewHide', 'Hide preview')
              : t(
                  'pages.lawyerWorkplace.settings.templates.previewShow',
                  'Preview with sample data'
                )}
          </button>
          {showPreview && (
            <div className="border-border bg-muted/40 rounded-xl border p-4">
              <p className="text-muted-foreground mb-2 text-[11px]">
                {t(
                  'pages.lawyerWorkplace.settings.templates.previewHint',
                  'Variables are shown with sample values. Real values are filled when a lawyer applies the template in a letter thread.'
                )}
              </p>
              <pre className="text-foreground font-sans text-[13px] break-words whitespace-pre-wrap">
                {body.trim()
                  ? previewText
                  : t(
                      'pages.lawyerWorkplace.settings.templates.previewEmpty',
                      'Write the template body to see a preview.'
                    )}
              </pre>
            </div>
          )}
        </div>
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
