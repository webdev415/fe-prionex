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
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { useClients } from '@/features/clients/hooks/useClients'
import { useLegalLawyers } from '@/features/lawyerWorkplace'
import { useAuthStore } from '@/stores/authStore'
import { useDebounce } from '@/hooks/useDebounce'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

function stripFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0) return filename
  return filename.slice(0, lastDot)
}

function formatClientOption(client: {
  id: number
  first_name: string
  last_name: string
  legacy_id?: string | null
}): { id: string; name: string } {
  const code = client.legacy_id?.trim() || `CL-${String(client.id).padStart(5, '0')}`
  const name = [client.first_name, client.last_name].filter(Boolean).join(' ')
  return { id: String(client.id), name: name ? `${code} · ${name}` : code }
}

interface AddIncomingDocumentModalProps {
  open: boolean
  onClose: () => void
  isSubmitting?: boolean
  onSubmit: (input: {
    title: string
    clientId: number
    assignedToUserId: number
    relatedLetterNumber?: string
    file: File
    contractNumber?: string | null
  }) => void | Promise<void>
}

export function AddIncomingDocumentModal({
  open,
  onClose,
  isSubmitting = false,
  onSubmit,
}: AddIncomingDocumentModalProps) {
  const { t } = useTranslation('common')
  const currentUserId = Number(useAuthStore((state) => state.user?.id))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: lawyersData } = useLegalLawyers({ enabled: open })

  const [file, setFile] = useState<File | null>(null)
  const [documentName, setDocumentName] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientLegacyId, setSelectedClientLegacyId] = useState<string | null>(null)
  const [assigneeUserId, setAssigneeUserId] = useState<number | null>(null)
  const [relatedLetterNumber, setRelatedLetterNumber] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const debouncedClientSearch = useDebounce(clientSearch, 300)
  const { data: clientsData, isFetching: clientsLoading } = useClients(
    { q: debouncedClientSearch, limit: 20 },
    { enabled: open && debouncedClientSearch.length >= 2 }
  )

  const lawyers = useMemo(() => lawyersData?.items ?? [], [lawyersData?.items])
  const clientOptions = useMemo(
    () => (clientsData?.items ?? []).map(formatClientOption),
    [clientsData?.items]
  )

  const selectedLawyer =
    lawyers.find((lawyer) => lawyer.user_id === assigneeUserId) ?? lawyers[0] ?? null

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setFile(null)
      setDocumentName('')
      setClientId('')
      setClientSearch('')
      setSelectedClientLegacyId(null)
      setRelatedLetterNumber('')
      setDragOver(false)
      const defaultLawyer =
        lawyers.find((lawyer) => lawyer.user_id === currentUserId) ?? lawyers[0] ?? null
      setAssigneeUserId(defaultLawyer?.user_id ?? null)
    })
  }, [currentUserId, lawyers, open])

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setDocumentName((current) => current || stripFileExtension(selectedFile.name))
  }

  const canSubmit = Boolean(
    file && documentName.trim() && clientId && assigneeUserId != null && lawyers.length > 0
  )

  const handleSubmit = async () => {
    if (!canSubmit || !file || assigneeUserId == null) return
    await onSubmit({
      title: documentName.trim(),
      clientId: Number.parseInt(clientId, 10),
      assignedToUserId: assigneeUserId,
      relatedLetterNumber: relatedLetterNumber.trim() || undefined,
      file,
      contractNumber: selectedClientLegacyId,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        title={t('pages.lawyerWorkplace.documents.modals.incoming.title', 'Add incoming document')}
      />
      <ModalContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.documents.modals.incoming.file', 'File')}
          </Label>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
              dragOver
                ? 'border-primary-400 bg-primary-50'
                : file
                  ? 'border-primary-300 bg-primary-50/50'
                  : 'border-secondary-300 hover:border-secondary-400 hover:bg-secondary-50'
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFileSelect(e.dataTransfer.files?.[0] ?? null)
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <Icons.File size={28} strokeWidth={1.5} className="text-primary-500" />
                <p className="text-dark-500 text-[13px] font-medium">{file.name}</p>
                <p className="text-light-600 text-[11px]">
                  {t(
                    'pages.lawyerWorkplace.documents.modals.incoming.changeFile',
                    'Click to replace'
                  )}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <Icons.FileImport size={28} strokeWidth={1.5} className="text-light-500" />
                <p className="text-dark-500 text-[13px]">
                  {t(
                    'pages.lawyerWorkplace.documents.modals.incoming.dropHint',
                    'Drag & drop or click to upload PDF, DOC, or image'
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.documents.modals.incoming.documentName', 'Document name')}
          </Label>
          <input
            type="text"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder={t(
              'pages.lawyerWorkplace.documents.modals.incoming.documentNamePlaceholder',
              'Enter document name'
            )}
            className="text-dark-500 focus:border-primary-400 h-10 w-full rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.documents.modals.incoming.client', 'Client · Contract')}
          </Label>
          <SearchableSelect
            options={clientOptions}
            value={clientId}
            onValueChange={(val) => {
              setClientId(val)
              const found = clientsData?.items.find((c) => String(c.id) === val)
              setSelectedClientLegacyId(found?.legacy_id?.trim() || null)
              setClientSearch('')
            }}
            onSearchChange={setClientSearch}
            isLoading={clientsLoading}
            emptySearchHint={t(
              'pages.lawyerWorkplace.documents.modals.incoming.clientSearchHint',
              'Type 2+ characters to search…'
            )}
            placeholder={t(
              'pages.lawyerWorkplace.documents.modals.incoming.selectClient',
              'Select client'
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t(
              'pages.lawyerWorkplace.documents.modals.incoming.relatedLetter',
              'Related inbox letter (optional)'
            )}
          </Label>
          <input
            type="text"
            value={relatedLetterNumber}
            onChange={(e) => setRelatedLetterNumber(e.target.value)}
            placeholder={t(
              'pages.lawyerWorkplace.documents.modals.incoming.relatedLetterPlaceholder',
              'e.g. IN-2026-142'
            )}
            className="text-dark-500 focus:border-primary-400 h-10 w-full rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-normal">
            {t('pages.lawyerWorkplace.documents.modals.incoming.assignee', 'Assignee')}
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
          variant="primary"
          size="md"
          leftIcon={<Icons.AddCircle size={18} strokeWidth={1.5} />}
          disabled={!canSubmit || isSubmitting}
          onClick={handleSubmit}
          className={cn('w-full', !canSubmit && 'opacity-60')}
        >
          {t('pages.lawyerWorkplace.documents.modals.incoming.submit', 'Register incoming')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
