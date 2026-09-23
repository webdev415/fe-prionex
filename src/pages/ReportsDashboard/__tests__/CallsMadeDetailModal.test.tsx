/**
 * CallsMadeDetailModal — board #1327 (D4, FE part) and #1333 (D9, FE part).
 *
 * react-i18next is mocked globally in src/test/setup.ts — t() returns the key.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CallsMadeDetailModal } from '../components/CallsMadeDetailModal'
import type { CallsMadeModalData } from '@/features/report'

function modalData(overrides: Partial<CallsMadeModalData> = {}): CallsMadeModalData {
  return {
    total: 8365,
    change: 3,
    changeType: 'increase',
    previousTotal: 8100,
    byHour: [],
    byOperator: [
      { name: 'Olena', calls: 5000 },
      { name: 'Petro', calls: 3321 },
    ],
    operatorsTotal: 8321,
    ...overrides,
  }
}

function renderModal(data: CallsMadeModalData) {
  return render(
    <CallsMadeDetailModal open onClose={vi.fn()} period="today" data={data} isLoading={false} />
  )
}

describe('CallsMadeDetailModal header vs operator list (D4 #1327)', () => {
  it('states the operator-list sum when it is below the header total', () => {
    renderModal(modalData())

    expect(screen.getByText('pages.reports.callsMadeModal.total: 8365')).toBeInTheDocument()
    expect(screen.getByTestId('calls-made-operators-total')).toHaveTextContent(
      'pages.reports.callsMadeModal.operatorsSum: 8321'
    )
  })

  it('states the operator-list sum when it is above the header total', () => {
    // PROD case: header 758 from a stale snapshot, live operator list 1 043.
    renderModal(
      modalData({
        total: 758,
        byOperator: [
          { name: 'Olena', calls: 600 },
          { name: 'Petro', calls: 443 },
        ],
        operatorsTotal: 1043,
      })
    )

    expect(screen.getByText('pages.reports.callsMadeModal.total: 758')).toBeInTheDocument()
    expect(screen.getByTestId('calls-made-operators-total')).toHaveTextContent(
      'pages.reports.callsMadeModal.operatorsSum: 1043'
    )
  })

  it('shows no extra line when the list adds up to the header', () => {
    renderModal(modalData({ total: 8321, operatorsTotal: 8321 }))

    expect(screen.queryByTestId('calls-made-operators-total')).not.toBeInTheDocument()
  })

  it('shows no extra line when there is no operator list to reconcile', () => {
    renderModal(modalData({ byOperator: [], operatorsTotal: 0 }))

    expect(screen.queryByTestId('calls-made-operators-total')).not.toBeInTheDocument()
  })
})

describe('CallsMadeDetailModal «По годинах» (D9 #1333)', () => {
  it('renders the hourly section when the hook provides hours', () => {
    renderModal(
      modalData({
        byHour: [
          { label: '09:00-10:00', calls: 10 },
          { label: '10:00-11:00', calls: 20 },
        ],
      })
    )

    expect(screen.getByText('pages.reports.callsMadeModal.byHour:')).toBeInTheDocument()
    expect(screen.getByText('09:00-10:00')).toBeInTheDocument()
    expect(screen.getByText('10:00-11:00')).toBeInTheDocument()
  })
})
