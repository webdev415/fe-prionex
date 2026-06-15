import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import { LEGAL_DOCUMENT_STATS, MOCK_LEGAL_DOCUMENTS } from '../../documents/documentsData'
import type { LegalDocumentTypeFilter } from '../../documents/types'
import { DocumentsStatsBar } from './DocumentsStatsBar'
import { DocumentsToolbar } from './DocumentsToolbar'
import { DocumentsTable } from './DocumentsTable'

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
  const { showWorkspaceBanner } = useLawyerWorkplaceLayout()
  const [typeFilter, setTypeFilter] = useState<LegalDocumentTypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return MOCK_LEGAL_DOCUMENTS.filter((doc) => {
      if (!matchesTypeFilter(typeFilter, doc)) return false
      if (!q) return true
      return (
        doc.number.toLowerCase().includes(q) ||
        doc.name.toLowerCase().includes(q) ||
        doc.clientName.toLowerCase().includes(q) ||
        doc.contractId.toLowerCase().includes(q) ||
        doc.assignee.toLowerCase().includes(q)
      )
    })
  }, [typeFilter, searchQuery])

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F2F3F0]">
      <div
        className={cn(
          'lawyer-workplace-scroll min-h-0 flex-1 overflow-y-auto',
          showWorkspaceBanner ? 'pb-24' : 'pb-6'
        )}
      >
        <DocumentsStatsBar stats={LEGAL_DOCUMENT_STATS} />
        <DocumentsToolbar
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
        <DocumentsTable documents={filteredDocuments} />
      </div>
    </div>
  )
}
