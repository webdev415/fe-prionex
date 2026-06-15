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
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { LEGAL_DOCUMENT_CLIENTS } from '../../documents/documentHelpers'
import type { LegalDocumentAssigneeId } from '../../documents/types'
import { DOCUMENT_ASSIGNEE_OPTIONS } from './constants'

const LAWYER_ASSIGNEE_OPTIONS = DOCUMENT_ASSIGNEE_OPTIONS.filter(
  (option) => option.id !== 'system' && option.id !== 'emailService'
)

const DEFAULT_ASSIGNEE_ID: LegalDocumentAssigneeId = 'kostenko'

function stripFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0) return filename
  return filename.slice(0, lastDot)
}

interface AddIncomingDocumentModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (input: {
    nameFallback: string
    clientId: string
    assigneeId: LegalDocumentAssigneeId
    relatedLetterNumber?: string
    fileName: string
  }) => void
}

export function AddIncomingDocumentModal({
  open,
  onClose,
  onSubmit,
}: AddIncomingDocumentModalProps) {
  const { t } = useTranslation('common')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [documentName, setDocumentName] = useState('')
  const [clientId, setClientId] = useState('')
  const [assigneeId, setAssigneeId] = useState<LegalDocumentAssigneeId>(DEFAULT_ASSIGNEE_ID)
  const [relatedLetterNumber, setRelatedLetterNumber] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const clientOptions = useMemo(
    () =>
      LEGAL_DOCUMENT_CLIENTS.map((client) => ({
        id: client.id,
        name: `${client.name} · ${client.contractId}`,
      })),
    []
  )

  const selectedAssignee =
    LAWYER_ASSIGNEE_OPTIONS.find((option) => option.id === assigneeId) ??
    LAWYER_ASSIGNEE_OPTIONS[0]!

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setFile(null)
      setDocumentName('')
      setClientId('')
      setAssigneeId(DEFAULT_ASSIGNEE_ID)
      setRelatedLetterNumber('')
      setDragOver(false)
      setSubmitting(false)
    })
  }, [open])

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return
    setFile(selectedFile)
    setDocumentName((current) => current || stripFileExtension(selectedFile.name))
  }

  const canSubmit = Boolean(file && documentName.trim() && clientId)

  const handleSubmit = () => {
    if (!canSubmit || !file) return
    setSubmitting(true)
    onSubmit({
      nameFallback: documentName.trim(),
      clientId,
      assigneeId,
      relatedLetterNumber: relatedLetterNumber.trim() || undefined,
      fileName: file.name,
    })
    setSubmitting(false)
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
            onValueChange={setClientId}
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
          variant="primary"
          size="md"
          leftIcon={<Icons.AddCircle size={18} strokeWidth={1.5} />}
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className={cn('w-full', !canSubmit && 'opacity-60')}
        >
          {t('pages.lawyerWorkplace.documents.modals.incoming.submit', 'Register incoming')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
