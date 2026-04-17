/**
 * Document Upload Modal
 *
 * Opens on second click of "Документи" tab.
 * Fields: file (drag & drop), document type, credit (optional).
 */

import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { documentApi } from '@/features/clients/api/documentApi'
import { clientKeys } from '@/features/clients/hooks/useClients'
import { cn } from '@/lib/utils'

interface Loan {
  id: number
  loanNumber: string
  counterparty: string
}

interface DocumentUploadModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  loans: Loan[]
}

const DOC_TYPES = [
  { value: 'passport', label: 'Паспорт' },
  { value: 'inn', label: 'ІНН' },
  { value: 'contract', label: 'Договір' },
  { value: 'income', label: 'Довідка про доходи' },
  { value: 'outcome', label: 'Витяг' },
  { value: 'signature', label: 'ЕЦП' },
  { value: 'other', label: 'Інше' },
]

export function DocumentUploadModal({ open, onClose, clientId, loans }: DocumentUploadModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState('other')
  const [debtId, setDebtId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFile(f)
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      await documentApi.upload(clientId, file, docType, debtId)
      queryClient.invalidateQueries({ queryKey: clientKeys.documents(clientId) })
      toast.success(t('common.success', 'Success'))
      // Reset and close
      setFile(null)
      setDocType('other')
      setDebtId(null)
      onClose()
    } catch {
      toast.error(t('common.error', 'Error'))
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setDocType('other')
    setDebtId(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="md">
      <ModalHeader title={t('pages.clients.detail.uploadDocument', 'Завантажити документ')} />

      <div className="flex flex-col gap-4 p-4 md:p-6">
        {/* File drop zone */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
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
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-primary-500"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-secondary-900 text-sm font-medium">{file.name}</span>
              <span className="text-secondary-500 text-xs">{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-secondary-400"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-secondary-600 text-sm">
                {t(
                  'pages.clients.detail.dropFileHere',
                  'Перетягніть файл або натисніть для вибору'
                )}
              </span>
            </div>
          )}
        </div>

        {/* Document type & Credit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-secondary-700 mb-1 block text-sm font-medium">
              {t('pages.clients.detail.tableHeaders.documentType', 'Тип документа')}
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="border-secondary-300 text-secondary-900 focus:border-primary-400 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            >
              {DOC_TYPES.map((dt) => (
                <option key={dt.value} value={dt.value}>
                  {dt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-secondary-700 mb-1 block text-sm font-medium">
              {t('pages.clients.detail.loan', 'Кредит')}
            </label>
            <select
              value={debtId ?? ''}
              onChange={(e) => setDebtId(e.target.value ? Number(e.target.value) : null)}
              className="border-secondary-300 text-secondary-900 focus:border-primary-400 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
            >
              <option value="">
                {t('pages.clients.detail.documentsUnlinked', "Без прив'язки")}
              </option>
              {loans.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  #{loan.loanNumber} — {loan.counterparty}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose}>
          {t('common.cancel', 'Скасувати')}
        </Button>
        <Button onClick={handleUpload} disabled={!file || uploading}>
          {uploading
            ? t('common.loading', 'Завантаження...')
            : t('pages.clients.detail.uploadDocument', 'Завантажити')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
