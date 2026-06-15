import { useMemo, useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import {
  computeDocumentFilterCounts,
  computeDocumentStats,
  createGeneratedDocument,
  createIncomingDocument,
  matchesDocumentTypeFilter,
} from '../../documents/documentHelpers'
import { MOCK_LEGAL_DOCUMENTS } from '../../documents/documentsData'
import type { LegalDocumentRow, LegalDocumentTypeFilter } from '../../documents/types'
import { AddIncomingDocumentModal } from './AddIncomingDocumentModal'
import { documentMatchesSearch } from './constants'
import { DocumentDetailDrawer } from './DocumentDetailDrawer'
import { DocumentsStatsBar } from './DocumentsStatsBar'
import { DocumentsToolbar } from './DocumentsToolbar'
import { DocumentsTable } from './DocumentsTable'
import { GenerateDocumentModal } from './GenerateDocumentModal'

const DEFAULT_PAGE_SIZE = 20

export function LegalDocumentsTab() {
  const { t } = useTranslation('common')
  const { isCompact, showWorkspaceBanner } = useLawyerWorkplaceLayout()
  const [documents, setDocuments] = useState<LegalDocumentRow[]>(() => [...MOCK_LEGAL_DOCUMENTS])
  const [typeFilter, setTypeFilter] = useState<LegalDocumentTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [addIncomingOpen, setAddIncomingOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<LegalDocumentRow | null>(null)

  const stats = useMemo(() => computeDocumentStats(documents), [documents])
  const filterCounts = useMemo(() => computeDocumentFilterCounts(documents), [documents])

  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        if (!matchesDocumentTypeFilter(typeFilter, doc)) return false
        return documentMatchesSearch(doc, searchQuery, t)
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [documents, typeFilter, searchQuery, t])

  const totalItems = filteredDocuments.length
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1

  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredDocuments.slice(start, start + pageSize)
  }, [filteredDocuments, currentPage, pageSize])

  const handleTypeFilterChange = (filter: LegalDocumentTypeFilter) => {
    setTypeFilter(filter)
    setPage(1)
  }

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query)
    setPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const handleGenerateSubmit: ComponentProps<typeof GenerateDocumentModal>['onSubmit'] = (
    input
  ) => {
    const newDocument = createGeneratedDocument(documents, {
      type: input.type,
      nameKey: input.template.key,
      nameFallback: input.template.fallback,
      clientId: input.clientId,
      assigneeId: input.assigneeId,
    })

    setDocuments((prev) => [newDocument, ...prev])
    setPage(1)
    toast.success(
      t('pages.lawyerWorkplace.documents.modals.generate.success', 'Document generated'),
      { description: newDocument.number }
    )
  }

  const handleIncomingSubmit: ComponentProps<typeof AddIncomingDocumentModal>['onSubmit'] = (
    input
  ) => {
    const newDocument = createIncomingDocument(documents, {
      nameFallback: input.nameFallback,
      clientId: input.clientId,
      assigneeId: input.assigneeId,
      relatedLetterNumber: input.relatedLetterNumber,
    })

    setDocuments((prev) => [newDocument, ...prev])
    setPage(1)
    toast.success(
      t('pages.lawyerWorkplace.documents.modals.incoming.success', 'Incoming document registered'),
      { description: newDocument.number }
    )
  }

  return (
    <>
      <div
        className={cn(
          'min-w-0 bg-[#F2F3F0]',
          showWorkspaceBanner ? 'pb-24' : 'pb-6',
          isCompact && !showWorkspaceBanner && 'pb-8'
        )}
      >
        <DocumentsStatsBar stats={stats} />
        <DocumentsToolbar
          typeFilter={typeFilter}
          onTypeFilterChange={handleTypeFilterChange}
          searchQuery={searchQuery}
          onSearchQueryChange={handleSearchQueryChange}
          filterCounts={filterCounts}
          onGenerateDocument={() => setGenerateOpen(true)}
          onAddIncoming={() => setAddIncomingOpen(true)}
        />
        <DocumentsTable
          documents={paginatedDocuments}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          onDocumentClick={setSelectedDocument}
        />
      </div>

      <GenerateDocumentModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={handleGenerateSubmit}
      />
      <AddIncomingDocumentModal
        open={addIncomingOpen}
        onClose={() => setAddIncomingOpen(false)}
        onSubmit={handleIncomingSubmit}
      />
      <DocumentDetailDrawer document={selectedDocument} onClose={() => setSelectedDocument(null)} />
    </>
  )
}
