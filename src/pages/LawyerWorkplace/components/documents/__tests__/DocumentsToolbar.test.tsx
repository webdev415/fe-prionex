import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  LawyerWorkplaceLayoutContext,
  type LawyerWorkplaceLayout,
} from '../../../context/lawyerWorkplaceLayout'
import type { LegalDocumentTypeFilter } from '../../../documents/types'
import { DocumentsToolbar } from '../DocumentsToolbar'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}))

const FILTER_COUNTS: Record<LegalDocumentTypeFilter, number> = {
  all: 0,
  incoming: 0,
  outgoing: 0,
  nbu_response: 0,
  uploaded: 0,
  generated: 0,
}

function renderToolbar(isCompact: boolean) {
  const layout: LawyerWorkplaceLayout = {
    ref: { current: null },
    contentWidth: isCompact ? 800 : 1280,
    isCompact,
    isKanbanGrid: !isCompact,
    isWide: !isCompact,
    showWorkspaceBanner: !isCompact,
  }
  return render(
    <LawyerWorkplaceLayoutContext.Provider value={layout}>
      <DocumentsToolbar
        typeFilter="all"
        onTypeFilterChange={vi.fn()}
        searchQuery=""
        onSearchQueryChange={vi.fn()}
        filterCounts={FILTER_COUNTS}
        onAddIncoming={vi.fn()}
      />
    </LawyerWorkplaceLayoutContext.Provider>
  )
}

describe('DocumentsToolbar — lawyer workplace has no "Generate document" action', () => {
  it('does not render the generate-document control (moved out of the legal desk)', () => {
    renderToolbar(false)
    expect(screen.queryByText('Generate document')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generate document' })).not.toBeInTheDocument()
  })

  it('still renders the "Add incoming" action', () => {
    renderToolbar(false)
    expect(screen.getByRole('button', { name: 'Add incoming' })).toBeInTheDocument()
  })

  it('has no generate action in compact mode either', () => {
    renderToolbar(true)
    expect(screen.queryByRole('button', { name: 'Generate document' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add incoming' })).toBeInTheDocument()
  })
})
