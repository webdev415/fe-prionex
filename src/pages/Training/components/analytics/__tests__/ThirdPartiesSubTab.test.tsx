/**
 * Render coverage for ThirdPartiesSubTab (KAN-736).
 *
 * Focus: the Figma frame is preserved (4 KPI tiles, operator dropdown + result
 * chip strip, 7-col table) and wired to useThirdParty — KPIs come from `kpis`,
 * rows from `items`, the result pill from the server-mapped `result_chip`, and
 * "returned to client" from `returned_to_client` / `returned_at`.
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { active_project_id: number } }) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

vi.mock('@/features/users/hooks', () => ({
  useOperators: () => ({
    data: [{ id: 41, full_name: 'Kateryna Antonova', department_name: 'Hard Collection' }],
  }),
}))

vi.mock('@/features/training/hooks/useExportThirdParty', () => ({
  useExportThirdParty: () => ({ mutate: vi.fn(), isPending: false }),
}))

// The recording modal pulls in callService / callStore — stub it out.
vi.mock('@/pages/ClientManagement/components/CallRecordingModal', () => ({
  CallRecordingModal: () => null,
}))

const thirdPartyMock = vi.hoisted(() => ({
  isLoading: false,
  isError: false,
  isFetching: false,
  data: {
    kpis: {
      total_calls: 2,
      returned_to_client: 1,
      did_not_return: 1,
      positive_count: 1,
      refusal_count: 1,
      will_pass_count: 0,
    },
    items: [
      {
        id: 1,
        datetime: '2026-05-13T09:30:00',
        operator_id: 41,
        operator_name: 'Kateryna Antonova',
        primary_client_id: 230114,
        primary_client_full_name: 'Smith Alice',
        contacted_phone: '0970001122',
        contact_relationship: 'Wife',
        duration_seconds: 95,
        result_code: 'agreement',
        result_chip: 'promise',
        returned_to_client: 'yes',
        returned_at: '2026-05-13T10:15:00',
        call_id: null,
      },
      {
        id: 2,
        datetime: '2026-05-13T09:10:00',
        operator_id: 42,
        operator_name: 'Denys Polyakov',
        primary_client_id: 236200,
        primary_client_full_name: 'Jones Bob',
        contacted_phone: '0504567890',
        contact_relationship: 'Brother',
        duration_seconds: 45,
        result_code: 'refusal_to_pay',
        result_chip: 'refusal',
        returned_to_client: 'did_not_pass',
        returned_at: null,
        call_id: null,
      },
    ],
    total: 2,
    page: 1,
    page_size: 50,
  },
}))
// Filter-aware mock (KAN-1027/KAN-1029 UX follow-up): picking an operator
// simulates the keepPreviousData window — the PREVIOUS rows are still in
// `data` while `isFetching` is true; picking a result chip simulates a
// SETTLED empty response.
vi.mock('@/features/training/hooks/useThirdParty', () => ({
  useThirdParty: (filters: { user_ids?: number[]; result_filter?: string }) => {
    if (filters.user_ids != null) {
      return { ...thirdPartyMock, isFetching: true }
    }
    if (filters.result_filter && filters.result_filter !== 'all') {
      return {
        ...thirdPartyMock,
        data: { ...thirdPartyMock.data, items: [], total: 0 },
      }
    }
    return thirdPartyMock
  },
}))

import { ThirdPartiesSubTab } from '../ThirdPartiesSubTab'

describe('ThirdPartiesSubTab', () => {
  it('renders the 4 KPI tiles from the BE kpis block', () => {
    render(<ThirdPartiesSubTab />)
    // total_calls=2 appears in a KPI tile AND the "All results" chip badge.
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
    // did_not_return / returned_to_client / positive_count = 1 each.
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })

  it('renders one row per BE item with the operator name and third-party phone', () => {
    render(<ThirdPartiesSubTab />)
    // Operator name appears in the row AND the dropdown <option>.
    expect(screen.getAllByText('Kateryna Antonova').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('0970001122')).toBeInTheDocument()
    expect(screen.getByText('Wife')).toBeInTheDocument()
  })

  it('maps result_chip to the result pill label', () => {
    render(<ThirdPartiesSubTab />)
    // The label appears in both the filter chip strip and the row pill.
    expect(
      screen.getAllByText('pages.training.thirdParties.result.promise').length
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByText('pages.training.thirdParties.result.refusal').length
    ).toBeGreaterThanOrEqual(1)
  })

  it('shows the returned-at timestamp for a returned call and "Did not return" otherwise', () => {
    render(<ThirdPartiesSubTab />)
    // returned_at formatted MM/DD HH:mm.
    expect(screen.getByText('05/13 10:15')).toBeInTheDocument()
    expect(screen.getByText('pages.training.thirdParties.returned.no')).toBeInTheDocument()
  })

  it('populates the operator dropdown from useOperators', () => {
    render(<ThirdPartiesSubTab />)
    const select = document.querySelector('select') as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.textContent)
    expect(options).toContain('Kateryna Antonova')
  })

  it('shows the refetch overlay over the kept rows when the operator filter changes', () => {
    render(<ThirdPartiesSubTab />)
    // Settled initial load — no overlay.
    expect(screen.queryByTestId('analytics-table-overlay')).not.toBeInTheDocument()

    const select = document.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '41' } })

    // The refetch is in flight: the kept (previous) rows are still rendered…
    expect(screen.getByText('0970001122')).toBeInTheDocument()
    // …but the table is explicitly marked as updating instead of silently
    // showing the previous manager's data.
    const overlay = screen.getByTestId('analytics-table-overlay')
    expect(overlay).toBeInTheDocument()
    expect(screen.getByText('pages.training.actionAnalysis.updating')).toBeInTheDocument()
    expect(overlay.closest('[aria-busy="true"]')).not.toBeNull()
  })

  it('shows the empty state (not the previous rows) when the filtered result is empty', () => {
    render(<ThirdPartiesSubTab />)
    expect(screen.getByText('0970001122')).toBeInTheDocument()

    // Result chip → the mock answers with a SETTLED empty page.
    fireEvent.click(
      screen.getByRole('button', { name: /pages\.training\.thirdParties\.result\.refusal/ })
    )

    expect(screen.getByText('pages.training.thirdParties.empty')).toBeInTheDocument()
    expect(screen.queryByText('0970001122')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analytics-table-overlay')).not.toBeInTheDocument()
  })
})
