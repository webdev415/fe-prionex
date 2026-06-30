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
import { useClients } from '@/features/clients/hooks/useClients'
import { useLegalLawyers } from '@/features/lawyerWorkplace'
import { useAuthStore } from '@/stores/authStore'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { NBU_DOCUMENT_NAMES, OUTGOING_DOCUMENT_NAMES, type DocumentI18nOption } from './constants'

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

function formatClientOption(client: {
  id: number
  first_name: string
  last_name: string
  legacy_id?: string | null
}): { id: string; name: string; contractNumber: string | null } {
  const code = client.legacy_id?.trim() || `CL-${String(client.id).padStart(5, '0')}`
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
  return {
    id: String(client.id),
    name: name ? `${code} · ${name}` : code,
    contractNumber: client.legacy_id?.trim() || null,
  }
}

interface GenerateDocumentModalProps {
  open: boolean
  onClose: () => void
  isSubmitting?: boolean
  onSubmit: (input: {
    documentType: GenerateDocumentType
    title: string
    clientId: number
    assignedToUserId: number
    contractNumber?: string | null
  }) => void | Promise<void>
}

export function GenerateDocumentModal({
  open,
  onClose,
  isSubmitting = false,
  onSubmit,
}: GenerateDocumentModalProps) {
  const { t } = useTranslation('common')
  const currentUserId = Number(useAuthStore((state) => state.user?.id))
  const { data: clientsData } = useClients({ limit: 200 }, { enabled: open })
  const { data: lawyersData } = useLegalLawyers({ enabled: open })

  const [documentType, setDocumentType] = useState<GenerateDocumentType>('outgoing')
  const [templateKey, setTemplateKey] = useState('')
  const [clientId, setClientId] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState<number | null>(null)

  const templates = useMemo(
    () => (documentType === 'outgoing' ? OUTGOING_DOCUMENT_NAMES : NBU_DOCUMENT_NAMES),
    [documentType]
  )

  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])

  const clientOptions = useMemo(
    () => (clientsData?.items ?? []).map(formatClientOption),
    [clientsData?.items]
  )

  const clientsById = useMemo(
    () => new Map((clientsData?.items ?? []).map((client) => [String(client.id), client])),
    [clientsData?.items]
  )

  const selectedTemplate = templates.find((template) => template.key === templateKey) ?? null
  const selectedTypeOption =
    GENERATE_TYPE_OPTIONS.find((option) => option.id === documentType) ?? GENERATE_TYPE_OPTIONS[0]!
  const selectedLawyer =
    lawyers.find((lawyer) => lawyer.user_id === assigneeUserId) ?? lawyers[0] ?? null

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setDocumentType('outgoing')
      setTemplateKey(OUTGOING_DOCUMENT_NAMES[0]?.key ?? '')
      setClientId('')
      const defaultLawyer =
        lawyers.find((lawyer) => lawyer.user_id === currentUserId) ?? lawyers[0] ?? null
      setAssigneeUserId(defaultLawyer?.user_id ?? null)
    })
  }, [currentUserId, lawyers, open])

  const handleDocumentTypeChange = (type: GenerateDocumentType) => {
    setDocumentType(type)
    const names = type === 'outgoing' ? OUTGOING_DOCUMENT_NAMES : NBU_DOCUMENT_NAMES
    setTemplateKey(names[0]?.key ?? '')
  }

  const canSubmit = Boolean(
    clientId && selectedTemplate && assigneeUserId != null && lawyers.length > 0
  )

  const handleSubmit = async () => {
    if (!canSubmit || !selectedTemplate || assigneeUserId == null) return
    const client = clientsById.get(clientId)
    await onSubmit({
      documentType,
      title: t(selectedTemplate.key, selectedTemplate.fallback),
      clientId: Number.parseInt(clientId, 10),
      assignedToUserId: assigneeUserId,
      contractNumber: client?.legacy_id?.trim() || null,
    })
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
              {templates.map((template: DocumentI18nOption) => (
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
            options={clientOptions.map((client) => ({ id: client.id, name: client.name }))}
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
                <span>{selectedLawyer?.display_name ?? '—'}</span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {lawyers.map((lawyer) => (
                <DropdownMenuItem
                  key={lawyer.id}
                  onClick={() => setAssigneeUserId(lawyer.user_id)}
                  className="cursor-pointer"
                >
                  {lawyer.display_name}
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
          disabled={isSubmitting}
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          leftIcon={<Icons.ArtificialIntelligence08 size={18} strokeWidth={1.5} />}
          disabled={!canSubmit || isSubmitting}
          onClick={handleSubmit}
          className={cn('w-full', !canSubmit && 'opacity-60')}
        >
          {t('pages.lawyerWorkplace.documents.modals.generate.submit', 'Generate & register')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
