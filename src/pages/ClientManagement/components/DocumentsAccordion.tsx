/**
 * Documents Accordion Component
 *
 * Groups documents by debt (credit) in collapsible sections, in render order:
 * - "Кредит #contract_number — counterparty" — per-debt sections
 * - "Без прив'язки до кредиту" — documents with debt_id = null, last
 *
 * Each document row has: filename, type badge, date, size, preview, download, delete buttons.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { documentApi, type ClientDocument } from '@/features/clients/api/documentApi'
import { DocumentTypePill } from '@/components/DocumentTypePill'
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
  const { t } = useTranslation('common')
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

  // Newest first within every section. ISO timestamps sort lexicographically,
  // so a string compare is chronological; DESC = (b, a).
  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [documents]
  )

  // Group documents by debt_id
  const unlinked = sortedDocuments.filter((d) => d.debt_id == null)
  const byDebt = new Map<number, ClientDocument[]>()
  for (const doc of sortedDocuments) {
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
    if (!confirm(t('common.confirmDelete', 'Are you sure you want to delete this item?'))) return
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
    <tr key={doc.id} className="border-border hover:bg-muted border-b last:border-b-0">
      <td
        className="text-foreground truncate px-3 py-2 text-sm font-medium"
        title={doc.original_filename}
      >
        <div className="flex items-center gap-2">
          <span className="truncate">{doc.original_filename}</span>
          {doc.source === 'generated' && (
            <span className="bg-primary/10 text-primary-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
              {t('pages.clients.detail.generatedBadge', 'Згенеровано')}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <DocumentTypePill
          name={doc.document_type_ref?.name ?? '—'}
          hex={doc.document_type_ref?.color ?? '#64748B'}
        />
      </td>
      <td className="text-muted-foreground px-3 py-2 text-sm">{formatDate(doc.created_at)}</td>
      <td className="text-muted-foreground px-3 py-2 text-sm">{formatFileSize(doc.file_size)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {/* Preview */}
          <button
            onClick={() => setPreviewDoc(doc)}
            className="hover:bg-primary-300/15 hover:text-primary-500 text-muted-foreground rounded-md p-1.5 transition-colors"
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
            className="hover:bg-primary-300/15 hover:text-primary-500 text-muted-foreground rounded-md p-1.5 transition-colors"
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
            className="hover:bg-error-100 rounded p-1 text-red-400 transition-colors hover:text-red-600"
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
    <table className="w-full table-fixed text-left">
      <colgroup>
        <col />
        <col className="w-[140px]" />
        <col className="w-[160px]" />
        <col className="w-[100px]" />
        <col className="w-[120px]" />
      </colgroup>
      <thead>
        <tr className="border-border text-foreground border-b text-xs font-medium">
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
          <th className="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>{docs.map(renderDocRow)}</tbody>
    </table>
  )

  const renderSection = (key: string, title: string, docs: ClientDocument[]) => {
    const isOpen = expanded.has(key)
    return (
      <div key={key} className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
        <button
          onClick={() => toggleSection(key)}
          className="text-foreground hover:bg-muted flex w-full items-center gap-2 px-4 py-3 text-left font-medium transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cn(
              'text-muted-foreground shrink-0 transition-transform',
              isOpen ? 'rotate-90' : ''
            )}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-sm">{title}</span>
          <span className="text-muted-foreground ml-auto text-sm font-normal">
            {docs.length} {docs.length === 1 ? 'док.' : 'док.'}
          </span>
        </button>
        {isOpen && <div className="border-border border-t">{renderDocTable(docs)}</div>}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 self-stretch py-45 md:gap-6">
        <div className="flex flex-col items-center justify-center gap-4 self-stretch sm:flex-row md:gap-6">
          <Icons.FileRemove size={48} className="text-muted-foreground" strokeWidth={0.5} />
          <p className="text-foreground text-center text-xl leading-tight font-light tracking-[-0.48px] md:text-2xl">
            {t('common.noDataFound', 'No data found')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Per-debt sections lead. byDebt is filled by a single walk of
          sortedDocuments, so its insertion order is first-appearance order,
          and Array.from preserves it. */}
      {Array.from(byDebt.entries()).map(([debtId, docs]) => {
        const loan = loanMap.get(debtId)
        const title = loan
          ? `${t('pages.clients.detail.loan', 'Кредит')} #${loan.loanNumber} — ${loan.counterparty}`
          : `${t('pages.clients.detail.loan', 'Кредит')} #${debtId}`
        return renderSection(`debt-${debtId}`, title, docs)
      })}

      {/* Unlinked documents render last: a document with no credit is the
          exception rather than what the operator opened the tab for. */}
      {unlinked.length > 0 &&
        renderSection(
          'unlinked',
          t('pages.clients.detail.documentsUnlinked', "Без прив'язки до кредиту"),
          unlinked
        )}

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
