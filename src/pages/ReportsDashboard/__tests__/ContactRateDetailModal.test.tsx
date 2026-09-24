/**
 * ContactRateDetailModal — the ranking floor of board #1326 (D3) and the
 * «Інше» outcome row (calls_other).
 *
 * react-i18next is mocked globally in src/test/setup.ts — t() returns the key.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContactRateDetailModal } from '../components/ContactRateDetailModal'
import type { ContactRateModalData } from '@/features/report'

function modalData(overrides: Partial<ContactRateModalData> = {}): ContactRateModalData {
  return {
    rate: 20,
    contacted: 20,
    total: 100,
    change: 0,
    changeType: 'increase',
    previousRate: 20,
    outcomes: [
      { key: 'answered', count: 20, percentage: 20 },
      { key: 'noAnswer', count: 50, percentage: 50 },
      { key: 'busy', count: 5, percentage: 5 },
      { key: 'failed', count: 5, percentage: 5 },
    ],
    bestPerformer: { name: 'Olena', rate: 30 },
    needsImprovement: { name: 'Petro', rate: 18 },
    ...overrides,
  }
}

function renderModal(data: ContactRateModalData) {
  return render(
    <ContactRateDetailModal open onClose={vi.fn()} period="today" data={data} isLoading={false} />
  )
}

const HINT = 'pages.reports.contactRateModal.notEnoughCallsToRank'

describe('ContactRateDetailModal ranking floor (D3 #1326)', () => {
  it('ranks operators when somebody has enough calls', () => {
    renderModal(modalData())

    expect(screen.getByText(/Olena \(30%\)/)).toBeInTheDocument()
    expect(screen.getByText(/Petro \(18%\)/)).toBeInTheDocument()
    expect(screen.queryByText(HINT)).not.toBeInTheDocument()
  })

  it('says there are not enough calls instead of silently dropping the block', () => {
    renderModal(modalData({ bestPerformer: null, needsImprovement: null }))

    expect(screen.getByText(HINT)).toBeInTheDocument()
    expect(
      screen.queryByText(/pages\.reports\.contactRateModal\.bestPerformer/)
    ).not.toBeInTheDocument()
  })

  it('shows only the best performer when a single operator qualifies', () => {
    renderModal(modalData({ needsImprovement: null }))

    expect(screen.getByText(/Olena \(30%\)/)).toBeInTheDocument()
    expect(screen.queryByText(HINT)).not.toBeInTheDocument()
  })
})

describe('ContactRateDetailModal «Результати дзвінків» — «Інше»', () => {
  it('renders the «Інше» row the hook provides', () => {
    renderModal(
      modalData({
        outcomes: [
          { key: 'answered', count: 20, percentage: 20 },
          { key: 'noAnswer', count: 55, percentage: 55 },
          { key: 'busy', count: 5, percentage: 5 },
          { key: 'failed', count: 5, percentage: 5 },
          { key: 'other', count: 15, percentage: 15 },
        ],
      })
    )

    expect(screen.getByText('pages.reports.contactRateModal.other')).toBeInTheDocument()
    expect(screen.getByText('15 (15%)')).toBeInTheDocument()
  })

  it('has no «Інше» row when the hook leaves it out', () => {
    renderModal(modalData())

    expect(screen.queryByText('pages.reports.contactRateModal.other')).not.toBeInTheDocument()
  })
})
