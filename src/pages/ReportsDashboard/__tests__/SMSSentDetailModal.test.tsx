/**
 * SMSSentDetailModal — a KPI without a trend (#1448).
 *
 * react-i18next is mocked globally in src/test/setup.ts — t() returns the key.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SMSSentDetailModal } from '../components/SMSSentDetailModal'
import type { SMSSentModalData } from '@/features/report'

function modalData(overrides: Partial<SMSSentModalData> = {}): SMSSentModalData {
  return {
    totalSent: 40,
    delivered: 36,
    failed: 2,
    pending: 2,
    deliveryRate: 90,
    change: 5,
    changeType: 'decrease',
    previousTotal: 42,
    byOperator: [],
    ...overrides,
  }
}

function renderModal(data: SMSSentModalData) {
  return render(
    <SMSSentDetailModal open onClose={vi.fn()} period="today" data={data} isLoading={false} />
  )
}

describe('SMSSentDetailModal without a KPI trend (#1448)', () => {
  it('shows the trend row when the KPI has a trend', () => {
    renderModal(modalData())

    expect(screen.getByText('5%')).toBeInTheDocument()
    expect(screen.getByText('pages.reports.kpi.vs')).toBeInTheDocument()
  })

  it('shows the total without an arrow, a bare «%» or a comparison when the trend is null', () => {
    renderModal(modalData({ change: null, changeType: null, previousTotal: null }))

    expect(screen.getByText('pages.reports.smsModal.totalSent: 40')).toBeInTheDocument()
    expect(screen.queryByText('pages.reports.kpi.vs')).not.toBeInTheDocument()
    expect(screen.queryByText('%')).not.toBeInTheDocument()
  })
})
