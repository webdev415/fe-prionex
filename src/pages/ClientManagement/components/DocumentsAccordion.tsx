/**
 * Documents Accordion Component
 *
 * Groups documents by debt (credit) in collapsible sections:
 * - "Без прив'язки до кредиту" — documents with debt_id = null
 * - "Кредит #contract_number — counterparty" — per-debt sections
 *
 * Each document row has: filename, type badge, date, size, preview, download, delete buttons.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { documentApi, type ClientDocument } from '@/features/clients/api/documentApi'
import { DocumentPreviewModal } from './DocumentPreviewModal'
import { clientKeys } from '@/features/clients/hooks/useClients'

interface Loan {
  id: number
  loanNumber: string
  counterparty: string
}

interface DocumentsAccordionProps {
  documents: ClientDocument[]
  loans: Loan[]
  clientId: number
}

const TYPE_LABELS: Record<string, string> = {
  passport: 'Паспорт',
  inn: 'ІНН',
  contract: 'Договір',
  income: 'Довідка',
  outcome: 'Витяг',
  signature: 'ЕЦП',
  other: 'Інше',
}

const TYPE_COLORS: Record<string, string> = {
  passport: 'bg-blue-100 text-blue-700',
  inn: 'bg-purple-100 text-purple-700',
  contract: 'bg-green-100 text-green-700',
  income: 'bg-amber-100 text-amber-700',
  outcome: 'bg-orange-100 text-orange-700',
  signature: 'bg-gray-100 text-gray-700',
  other: 'bg-slate-100 text-slate-600',
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString()
}

export function DocumentsAccordion({ documents, loans, clientId }: DocumentsAccordionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null)

  // Accordion state — expanded sections
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['unlinked']))

  const toggleSection = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Group documents by debt_id
  const unlinked = documents.filter((d) => d.debt_id == null)
  const byDebt = new Map<number, ClientDocument[]>()
  for (const doc of documents) {
    if (doc.debt_id != null) {
      const list = byDebt.get(doc.debt_id) ?? []
      list.push(doc)
      byDebt.set(doc.debt_id, list)
    }
  }

  // Build loan lookup
  const loanMap = new Map<number, Loan>()
  for (const loan of loans) {
    loanMap.set(loan.id, loan)
  }

  const handleDelete = async (doc: ClientDocument) => {
    if (!confirm(t('common.confirmDelete', 'Are you sure?'))) return
    try {
      await documentApi.delete(clientId, doc.id)
      queryClient.invalidateQueries({ queryKey: clientKeys.documents(clientId) })
      toast.success(t('common.deleted', 'Deleted'))
    } catch {
      toast.error(t('common.error', 'Error'))
    }
  }

  const handleDownload = (doc: ClientDocument) => {
    documentApi.download(clientId, doc.id, doc.original_filename)
  }

  const renderDocRow = (doc: ClientDocument) => (
    <tr key={doc.id} className="border-b border-[#EBECE8] last:border-b-0 hover:bg-[#F9FAF8]">
      <td className="px-3 py-2 text-sm font-medium text-[#05040D]">{doc.original_filename}</td>
      <td className="px-3 py-2">
        <span
          className={cn(
            'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
            TYPE_COLORS[doc.document_type] ?? TYPE_COLORS.other
          )}
        >
          {TYPE_LABELS[doc.document_type] ?? doc.document_type}
        </span>
      </td>
      <td className="px-3 py-2 text-sm text-[#6B7280]">{formatDate(doc.created_at)}</td>
      <td className="px-3 py-2 text-sm text-[#6B7280]">{formatFileSize(doc.file_size)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {/* Preview */}
          <button
            onClick={() => setPreviewDoc(doc)}
            className="hover:bg-primary-300/15 hover:text-primary-500 rounded-md p-1.5 text-[#6B7280] transition-colors"
            title={t('common.preview', 'Preview')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {/* Download */}
          <button
            onClick={() => handleDownload(doc)}
            className="hover:bg-primary-300/15 hover:text-primary-500 rounded-md p-1.5 text-[#6B7280] transition-colors"
            title={t('common.download', 'Download')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          {/* Delete */}
          <button
            onClick={() => handleDelete(doc)}
            className="rounded p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title={t('common.delete', 'Delete')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14H7L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )

  const renderDocTable = (docs: ClientDocument[]) => (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-[#EBECE8] text-xs font-medium text-[#05040D]">
          <th className="px-3 py-2">
            {t('pages.clients.detail.tableHeaders.documentName', 'Name')}
          </th>
          <th className="px-3 py-2">
            {t('pages.clients.detail.tableHeaders.documentType', 'Type')}
          </th>
          <th className="px-3 py-2">{t('pages.clients.detail.tableHeaders.uploadDate', 'Date')}</th>
          <th className="px-3 py-2">
            {t('pages.clients.detail.tableHeaders.documentSize', 'Size')}
          </th>
          <th className="w-[100px] px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>{docs.map(renderDocRow)}</tbody>
    </table>
  )

  const renderSection = (key: string, title: string, docs: ClientDocument[]) => {
    const isOpen = expanded.has(key)
    return (
      <div
        key={key}
        className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-sm"
      >
        <button
          onClick={() => toggleSection(key)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium text-[#05040D] transition-colors hover:bg-[#F9FAF8]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#374151"
            strokeWidth="2"
            className={cn('shrink-0 transition-transform', isOpen ? 'rotate-90' : '')}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm">{title}</span>
          <span className="ml-auto text-sm font-normal text-[#374151]">
            {docs.length} {docs.length === 1 ? 'док.' : 'док.'}
          </span>
        </button>
        {isOpen && <div className="border-t border-[#EBECE8]">{renderDocTable(docs)}</div>}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-secondary-400 flex w-full flex-col items-center justify-center py-12">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <p className="mt-3">{t('common.noDataFound', 'No data found')}</p>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Unlinked documents */}
      {unlinked.length > 0 &&
        renderSection(
          'unlinked',
          t('pages.clients.detail.documentsUnlinked', "Без прив'язки до кредиту"),
          unlinked
        )}

      {/* Per-debt sections */}
      {Array.from(byDebt.entries()).map(([debtId, docs]) => {
        const loan = loanMap.get(debtId)
        const title = loan
          ? `${t('pages.clients.detail.loan', 'Кредит')} #${loan.loanNumber} — ${loan.counterparty}`
          : `${t('pages.clients.detail.loan', 'Кредит')} #${debtId}`
        return renderSection(`debt-${debtId}`, title, docs)
      })}

      {/* Preview modal */}
      {previewDoc && (
        <DocumentPreviewModal
          open={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          clientId={clientId}
          documentId={previewDoc.id}
          filename={previewDoc.original_filename}
          mimeType={previewDoc.mime_type}
        />
      )}
    </div>
  )
}
