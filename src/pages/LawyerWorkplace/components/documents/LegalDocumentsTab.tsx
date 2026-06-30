import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  useGenerateLegalDocument,
  useLegalDocumentFilterCounts,
  useLegalDocuments,
  useLegalDocumentStats,
  useUploadIncomingLegalDocument,
} from '@/features/lawyerWorkplace'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import type { LegalDocumentTypeFilter, LegalDocumentRow } from '../../documents/types'
import { AddIncomingDocumentModal } from './AddIncomingDocumentModal'
import { DocumentDetailDrawer } from './DocumentDetailDrawer'
import { DocumentsStatsBar } from './DocumentsStatsBar'
import { DocumentsToolbar } from './DocumentsToolbar'
import { DocumentsTable } from './DocumentsTable'
import { GenerateDocumentModal } from './GenerateDocumentModal'

const DEFAULT_PAGE_SIZE = 20

const EMPTY_FILTER_COUNTS: Record<LegalDocumentTypeFilter, number> = {
  all: 0,
  incoming: 0,
  outgoing: 0,
  nbu_response: 0,
  uploaded: 0,
  generated: 0,
}

export function LegalDocumentsTab() {
  const { t } = useTranslation('common')
  const { isCompact, showWorkspaceBanner } = useLawyerWorkplaceLayout()
  const [typeFilter, setTypeFilter] = useState<LegalDocumentTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [addIncomingOpen, setAddIncomingOpen] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState<LegalDocumentRow | null>(null)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const listParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      type_filter: typeFilter,
      search: debouncedSearch.trim() || undefined,
    }),
    [debouncedSearch, page, pageSize, typeFilter]
  )

  const { documents, total, isLoading, isError, refetch } = useLegalDocuments(listParams)
  const { data: stats } = useLegalDocumentStats()
  const { data: filterCounts = EMPTY_FILTER_COUNTS } = useLegalDocumentFilterCounts()
  const uploadMutation = useUploadIncomingLegalDocument()
  const generateMutation = useGenerateLegalDocument()

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1

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

  const handleGenerateSubmit = async (input: {
    documentType: 'outgoing' | 'nbu_response'
    title: string
    clientId: number
    assignedToUserId: number
    contractNumber?: string | null
  }) => {
    try {
      const result = await generateMutation.mutateAsync({
        document_type: input.documentType,
        title: input.title,
        client_id: input.clientId,
        assigned_to_user_id: input.assignedToUserId,
        contract_number: input.contractNumber,
      })
      setPage(1)
      toast.success(
        t('pages.lawyerWorkplace.documents.modals.generate.success', 'Document generated'),
        { description: result.number }
      )
    } catch {
      // mutation toast handles errors
    }
  }

  const handleIncomingSubmit = async (input: {
    title: string
    clientId: number
    assignedToUserId: number
    relatedLetterNumber?: string
    file: File
    contractNumber?: string | null
  }) => {
    try {
      const result = await uploadMutation.mutateAsync({
        file: input.file,
        title: input.title,
        client_id: input.clientId,
        assigned_to_user_id: input.assignedToUserId,
        contract_number: input.contractNumber,
        related_letter_number: input.relatedLetterNumber,
      })
      setPage(1)
      toast.success(
        t(
          'pages.lawyerWorkplace.documents.modals.incoming.success',
          'Incoming document registered'
        ),
        { description: result.number }
      )
    } catch {
      // mutation toast handles errors
    }
  }

  return (
    <>
      <div
        className={cn(
          'min-w-0',
          showWorkspaceBanner ? 'pb-24' : 'pb-6',
          isCompact && !showWorkspaceBanner && 'pb-8'
        )}
      >
        <DocumentsStatsBar
          stats={
            stats ?? {
              incomingCount: 0,
              incomingYearTotal: new Date().getFullYear(),
              outgoingCount: 0,
              outgoingYearTotal: new Date().getFullYear(),
              nbuCount: 0,
              nbuYearTotal: new Date().getFullYear(),
              generatedPercent: 0,
            }
          }
        />
        <DocumentsToolbar
          typeFilter={typeFilter}
          onTypeFilterChange={handleTypeFilterChange}
          searchQuery={searchQuery}
          onSearchQueryChange={handleSearchQueryChange}
          filterCounts={filterCounts}
          onGenerateDocument={() => setGenerateOpen(true)}
          onAddIncoming={() => setAddIncomingOpen(true)}
        />

        {isLoading && (
          <p className="text-light-600 px-4 py-10 text-center text-sm sm:px-5 lg:px-7">
            {t('pages.lawyerWorkplace.documents.loading', 'Loading documents…')}
          </p>
        )}

        {isError && !isLoading && (
          <div className="px-4 py-10 text-center sm:px-5 lg:px-7">
            <p className="text-error-600 text-sm">
              {t('pages.lawyerWorkplace.documents.loadError', 'Could not load documents')}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-secondary-800 mt-2 text-sm font-medium underline"
            >
              {t('actions.retry', 'Retry')}
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <DocumentsTable
            documents={documents}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            onDocumentClick={setSelectedDocument}
          />
        )}
      </div>

      <GenerateDocumentModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={handleGenerateSubmit}
        isSubmitting={generateMutation.isPending}
      />
      <AddIncomingDocumentModal
        open={addIncomingOpen}
        onClose={() => setAddIncomingOpen(false)}
        onSubmit={handleIncomingSubmit}
        isSubmitting={uploadMutation.isPending}
      />
      <DocumentDetailDrawer document={selectedDocument} onClose={() => setSelectedDocument(null)} />
    </>
  )
}
