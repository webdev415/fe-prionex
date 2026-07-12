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
import { DocumentClientContractFields } from './DocumentClientContractFields'
import { useLegalLawyers, useDocumentClientContract } from '@/features/lawyerWorkplace'
import { useAuthStore } from '@/stores/authStore'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

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
  const { data: lawyersData } = useLegalLawyers({ enabled: open, scopedToActiveProject: true })

  const [documentType, setDocumentType] = useState<GenerateDocumentType>('outgoing')
  const [documentName, setDocumentName] = useState('')
  const [clientId, setClientId] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState<number | null>(null)

  const {
    contracts,
    contractsLoading,
    contractNumber,
    setContractNumber,
    requiresSelection,
    hasValidContract,
    resetContract,
  } = useDocumentClientContract(clientId, open)

  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])

  const selectedTypeOption =
    GENERATE_TYPE_OPTIONS.find((option) => option.id === documentType) ?? GENERATE_TYPE_OPTIONS[0]!
  const selectedLawyer =
    lawyers.find((lawyer) => lawyer.user_id === assigneeUserId) ??
    lawyers.find((lawyer) => lawyer.user_id === currentUserId) ??
    lawyers[0] ??
    null

  const effectiveAssigneeUserId = assigneeUserId ?? selectedLawyer?.user_id ?? null

  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (wasOpenRef.current) return
    wasOpenRef.current = true

    requestAnimationFrame(() => {
      setDocumentType('outgoing')
      setDocumentName('')
      setClientId('')
      resetContract()
      setAssigneeUserId(null)
    })
  }, [open, resetContract])

  const canSubmit = Boolean(
    documentName.trim() &&
    clientId &&
    effectiveAssigneeUserId != null &&
    lawyers.length > 0 &&
    hasValidContract
  )

  const handleSubmit = async () => {
    if (!canSubmit || effectiveAssigneeUserId == null) return
    await onSubmit({
      documentType,
      title: documentName.trim(),
      clientId: Number.parseInt(clientId, 10),
      assignedToUserId: effectiveAssigneeUserId,
      contractNumber: contractNumber.trim() || null,
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
                  onClick={() => setDocumentType(option.id)}
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
            {t('pages.lawyerWorkplace.documents.modals.generate.documentName', 'Document name')}
          </Label>
          <input
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder={t(
              'pages.lawyerWorkplace.documents.modals.generate.documentNamePlaceholder',
              'Enter document name'
            )}
            className="text-dark-500 focus:border-primary-400 h-10 w-full rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] font-light outline-none"
          />
        </div>

        <DocumentClientContractFields
          scope="generate"
          enabled={open}
          clientId={clientId}
          onClientIdChange={setClientId}
          contracts={contracts}
          contractsLoading={contractsLoading}
          contractNumber={contractNumber}
          onContractNumberChange={setContractNumber}
          requiresSelection={requiresSelection}
        />

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
