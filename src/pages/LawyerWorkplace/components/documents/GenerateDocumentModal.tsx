import { useEffect, useMemo, useState } from 'react'
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
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { LEGAL_DOCUMENT_CLIENTS } from '../../documents/documentHelpers'
import type { LegalDocumentAssigneeId } from '../../documents/types'
import {
  DOCUMENT_ASSIGNEE_OPTIONS,
  NBU_DOCUMENT_NAMES,
  OUTGOING_DOCUMENT_NAMES,
  type DocumentI18nOption,
} from './constants'

type GenerateDocumentType = 'outgoing' | 'nbu_response'

const GENERATE_TYPE_OPTIONS: {
  id: GenerateDocumentType
  labelKey: string
  fallback: string
  badge: string
}[] = [
  {
    id: 'outgoing',
    labelKey: 'pages.lawyerWorkplace.documents.modals.generate.types.outgoing',
    fallback: 'Outgoing (ВИХ)',
    badge: 'ВИХ',
  },
  {
    id: 'nbu_response',
    labelKey: 'pages.lawyerWorkplace.documents.modals.generate.types.nbu',
    fallback: 'NBU reply (НБУ)',
    badge: 'НБУ',
  },
]

const LAWYER_ASSIGNEE_OPTIONS = DOCUMENT_ASSIGNEE_OPTIONS.filter(
  (option) => option.id !== 'system' && option.id !== 'emailService'
)

const DEFAULT_ASSIGNEE_ID: LegalDocumentAssigneeId = 'kostenko'

interface GenerateDocumentModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: {
    type: GenerateDocumentType
    template: DocumentI18nOption
    clientId: string
    assigneeId: LegalDocumentAssigneeId
  }) => void
}

export function GenerateDocumentModal({ open, onClose, onSubmit }: GenerateDocumentModalProps) {
  const { t } = useTranslation('common')
  const [documentType, setDocumentType] = useState<GenerateDocumentType>('outgoing')
  const [templateKey, setTemplateKey] = useState('')
  const [clientId, setClientId] = useState('')
  const [assigneeId, setAssigneeId] = useState<LegalDocumentAssigneeId>(DEFAULT_ASSIGNEE_ID)
  const [submitting, setSubmitting] = useState(false)

  const templates = useMemo(
    () => (documentType === 'outgoing' ? OUTGOING_DOCUMENT_NAMES : NBU_DOCUMENT_NAMES),
    [documentType]
  )

  const selectedTemplate = templates.find((template) => template.key === templateKey) ?? null
  const selectedTypeOption =
    GENERATE_TYPE_OPTIONS.find((option) => option.id === documentType) ?? GENERATE_TYPE_OPTIONS[0]!
  const selectedAssignee =
    LAWYER_ASSIGNEE_OPTIONS.find((option) => option.id === assigneeId) ??
    LAWYER_ASSIGNEE_OPTIONS[0]!

  const clientOptions = useMemo(
    () =>
      LEGAL_DOCUMENT_CLIENTS.map((client) => ({
        id: client.id,
        name: `${client.name} · ${client.contractId}`,
      })),
    []
  )

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setDocumentType('outgoing')
      setTemplateKey(OUTGOING_DOCUMENT_NAMES[0]?.key ?? '')
      setClientId('')
      setAssigneeId(DEFAULT_ASSIGNEE_ID)
      setSubmitting(false)
    })
  }, [open])

  const handleDocumentTypeChange = (type: GenerateDocumentType) => {
    setDocumentType(type)
    const names = type === 'outgoing' ? OUTGOING_DOCUMENT_NAMES : NBU_DOCUMENT_NAMES
    setTemplateKey(names[0]?.key ?? '')
  }

  const canSubmit = Boolean(clientId && selectedTemplate)

  const handleSubmit = () => {
    if (!canSubmit || !selectedTemplate) return
    setSubmitting(true)
    onSubmit({
      type: documentType,
      template: selectedTemplate,
      clientId,
      assigneeId,
    })
    setSubmitting(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        title={t('pages.lawyerWorkplace.documents.modals.generate.title', 'Generate document')}
      />
      <ModalContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.documents.modals.generate.documentType', 'Document type')}
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex h-10 w-full items-center justify-between rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] font-light"
              >
                <span className="flex items-center gap-2">
                  <span className="bg-secondary-100 text-secondary-800 rounded px-1.5 py-0.5 text-[10px] font-medium">
                    {selectedTypeOption.badge}
                  </span>
                  {t(selectedTypeOption.labelKey, selectedTypeOption.fallback)}
                </span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {GENERATE_TYPE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  onClick={() => handleDocumentTypeChange(option.id)}
                  className="cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="bg-secondary-100 text-secondary-800 rounded px-1.5 py-0.5 text-[10px] font-medium">
                      {option.badge}
                    </span>
                    {t(option.labelKey, option.fallback)}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.documents.modals.generate.template', 'Template')}
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex h-10 w-full items-center justify-between rounded-[8px] border border-gray-200 bg-white px-3 text-left text-[13px] font-light"
              >
                <span className="truncate">
                  {selectedTemplate
                    ? t(selectedTemplate.key, selectedTemplate.fallback)
                    : t(
                        'pages.lawyerWorkplace.documents.modals.generate.selectTemplate',
                        'Select template'
                      )}
                </span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-[240px] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
            >
              {templates.map((template) => (
                <DropdownMenuItem
                  key={template.key}
                  onClick={() => setTemplateKey(template.key)}
                  className="cursor-pointer"
                >
                  {t(template.key, template.fallback)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.documents.modals.generate.client', 'Client · Contract')}
          </Label>
          <SearchableSelect
            options={clientOptions}
            value={clientId}
            onValueChange={setClientId}
            placeholder={t(
              'pages.lawyerWorkplace.documents.modals.generate.selectClient',
              'Select client'
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.documents.modals.generate.assignee', 'Assignee')}
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex h-10 w-full items-center justify-between rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] font-light"
              >
                <span>{t(selectedAssignee.key, selectedAssignee.fallback)}</span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {LAWYER_ASSIGNEE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  onClick={() => setAssigneeId(option.id)}
                  className="cursor-pointer"
                >
                  {t(option.key, option.fallback)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          variant="outline"
          size="md"
          className="w-full"
          onClick={onClose}
          disabled={submitting}
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          leftIcon={<Icons.ArtificialIntelligence08 size={18} strokeWidth={1.5} />}
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className={cn('w-full', !canSubmit && 'opacity-60')}
        >
          {t('pages.lawyerWorkplace.documents.modals.generate.submit', 'Generate & register')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
