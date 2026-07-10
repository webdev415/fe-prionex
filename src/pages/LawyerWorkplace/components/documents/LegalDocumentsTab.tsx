import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import {
  useGenerateLegalDocument,
  useLegalDocumentFilterCounts,
  useLegalDocuments,
  useLegalDocumentStats,
  useUploadIncomingLegalDocument,
} from '@/features/lawyerWorkplace'
import { useDebounce } from '@/hooks/useDebounce'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import type { LegalDocumentTypeFilter, LegalDocumentRow } from '../../documents/types'
import { DOCUMENT_TYPE_FILTERS } from './constants'
import { AddIncomingDocumentModal } from './AddIncomingDocumentModal'
import { DocumentDetailDrawer } from './DocumentDetailDrawer'
import { DocumentsStatsBar } from './DocumentsStatsBar'
import { DocumentsPageSkeleton, DocumentsTableSkeleton } from './DocumentsTabSkeleton'
import { DocumentsToolbar } from './DocumentsToolbar'
import { DocumentsTable } from './DocumentsTable'
import { GenerateDocumentModal } from './GenerateDocumentModal'

const DEFAULT_PAGE_SIZE = 20

const EMPTY_STATS = {
  incomingCount: 0,
  incomingYearTotal: new Date().getFullYear(),
  outgoingCount: 0,
  outgoingYearTotal: new Date().getFullYear(),
  nbuCount: 0,
  nbuYearTotal: new Date().getFullYear(),
  generatedPercent: 0,
  filterCounts: {
    all: 0,
    incoming: 0,
    outgoing: 0,
    nbu_response: 0,
    uploaded: 0,
    generated: 0,
  },
} as const

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

  const { documents, total, isPending, isFetching, isError, refetch } =
    useLegalDocuments(listParams)
  const { data: stats } = useLegalDocumentStats()
  const { data: filterCounts } = useLegalDocumentFilterCounts()
  const uploadMutation = useUploadIncomingLegalDocument()
  const generateMutation = useGenerateLegalDocument()

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1
  // First visit: full-page skeleton only. Filter/search/page changes: table skeleton only.
  const isInitialLoading = isPending
  const isTableLoading = !isPending && isFetching
  const showEmptyState = !isInitialLoading && !isTableLoading && !isError && documents.length === 0
  const showTable = !isInitialLoading && !isTableLoading && !isError && documents.length > 0
  const hasSearch = debouncedSearch.trim().length > 0
  const hasTypeFilter = typeFilter !== 'all'

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

  const emptyState = useMemo(() => {
    if (hasSearch) {
      return {
        icon: <Icons.Search size={22} strokeWidth={1.5} className="text-light-500" />,
        title: t('pages.lawyerWorkplace.documents.empty.search.title', 'No matching documents'),
        description: t(
          'pages.lawyerWorkplace.documents.empty.search.description',
          'Try a different search term or clear the search to see all documents.'
        ),
      }
    }

    if (hasTypeFilter) {
      const filterMeta = DOCUMENT_TYPE_FILTERS.find((filter) => filter.id === typeFilter)
      const filterLabel = filterMeta
        ? t(filterMeta.labelKey, filterMeta.fallback)
        : t('pages.lawyerWorkplace.documents.filters.allTypes', 'All types')

      return {
        icon: <Icons.Filter size={22} strokeWidth={1.5} className="text-light-500" />,
        title: t('pages.lawyerWorkplace.documents.empty.filter.title', 'No documents in this view'),
        description: t('pages.lawyerWorkplace.documents.empty.filter.description', {
          filter: filterLabel,
          defaultValue: `Nothing matches the «${filterLabel}» filter. Try another type or show all documents.`,
        }),
      }
    }

    return {
      icon: <Icons.File size={22} strokeWidth={1.5} className="text-light-500" />,
      title: t('pages.lawyerWorkplace.documents.empty.title', 'No documents yet'),
      description: t(
        'pages.lawyerWorkplace.documents.empty.description',
        'Register an incoming document or generate an outgoing letter to start the legal document journal.'
      ),
    }
  }, [hasSearch, hasTypeFilter, t, typeFilter])

  return (
    <>
      <div
        className={cn(
          'min-w-0',
          showWorkspaceBanner ? 'pb-24' : 'pb-6',
          isCompact && !showWorkspaceBanner && 'pb-8'
        )}
      >
        {isInitialLoading ? (
          <DocumentsPageSkeleton />
        ) : (
          <>
            {!isError ? (
              <>
                <DocumentsStatsBar stats={stats ?? EMPTY_STATS} />
                <DocumentsToolbar
                  typeFilter={typeFilter}
                  onTypeFilterChange={handleTypeFilterChange}
                  searchQuery={searchQuery}
                  onSearchQueryChange={handleSearchQueryChange}
                  filterCounts={filterCounts}
                  onGenerateDocument={() => setGenerateOpen(true)}
                  onAddIncoming={() => setAddIncomingOpen(true)}
                />
              </>
            ) : null}

            {isError ? (
              <div
                className="flex flex-col items-center justify-center px-6 py-14 text-center sm:px-5 lg:px-7"
                role="alert"
              >
                <div className="bg-error-50 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <Icons.Warning size={22} strokeWidth={1.5} className="text-error-500" />
                </div>
                <p className="text-dark-500 text-[14px] font-medium">
                  {t('pages.lawyerWorkplace.documents.loadError.title', 'Could not load documents')}
                </p>
                <p className="text-light-600 mt-1 max-w-sm text-[12px] leading-relaxed">
                  {t(
                    'pages.lawyerWorkplace.documents.loadError.description',
                    'Check your connection and try again.'
                  )}
                </p>
                <Button
                  type="button"
                  variant="cancel"
                  size="sm"
                  onClick={() => refetch()}
                  className="mt-5 h-9 rounded-md"
                >
                  {t('actions.retry', 'Retry')}
                </Button>
              </div>
            ) : null}

            {isTableLoading ? <DocumentsTableSkeleton rows={Math.min(pageSize, 8)} /> : null}

            {showEmptyState ? (
              <div
                className="mx-4 flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white px-6 py-14 text-center sm:mx-5 lg:mx-7"
                role="status"
              >
                <div className="bg-light-100 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  {emptyState.icon}
                </div>
                <p className="text-dark-500 text-[14px] font-medium">{emptyState.title}</p>
                <p className="text-light-600 mt-1 max-w-sm text-[12px] leading-relaxed">
                  {emptyState.description}
                </p>
              </div>
            ) : null}

            {showTable ? (
              <DocumentsTable
                documents={documents}
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={handlePageSizeChange}
                onDocumentClick={setSelectedDocument}
              />
            ) : null}
          </>
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
