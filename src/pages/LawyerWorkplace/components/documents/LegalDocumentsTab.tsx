import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import { LEGAL_DOCUMENT_STATS, MOCK_LEGAL_DOCUMENTS } from '../../documents/documentsData'
import type { LegalDocumentTypeFilter } from '../../documents/types'
import { documentMatchesSearch } from './constants'
import { DocumentsStatsBar } from './DocumentsStatsBar'
import { DocumentsToolbar } from './DocumentsToolbar'
import { DocumentsTable } from './DocumentsTable'

const DEFAULT_PAGE_SIZE = 20

function matchesTypeFilter(
  filter: LegalDocumentTypeFilter,
  doc: (typeof MOCK_LEGAL_DOCUMENTS)[number]
): boolean {
  if (filter === 'all') return true
  if (filter === 'uploaded') return doc.action === 'uploaded'
  if (filter === 'generated') return doc.action === 'generated'
  return doc.type === filter
}

export function LegalDocumentsTab() {
  const { t } = useTranslation('common')
  const { showWorkspaceBanner } = useLawyerWorkplaceLayout()
  const [typeFilter, setTypeFilter] = useState<LegalDocumentTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const filteredDocuments = useMemo(() => {
    return MOCK_LEGAL_DOCUMENTS.filter((doc) => {
      if (!matchesTypeFilter(typeFilter, doc)) return false
      return documentMatchesSearch(doc, searchQuery, t)
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [typeFilter, searchQuery, t])

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

  return (
    <div className={cn('bg-[#F2F3F0]', showWorkspaceBanner ? 'pb-24' : 'pb-6')}>
      <DocumentsStatsBar stats={LEGAL_DOCUMENT_STATS} />
      <DocumentsToolbar
        typeFilter={typeFilter}
        onTypeFilterChange={handleTypeFilterChange}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
      />
      <DocumentsTable
        documents={paginatedDocuments}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
