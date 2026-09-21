/**
 * Render coverage for LeaksSubTab (KAN-735).
 *
 * Focus: the Figma frame is preserved (info banner, 3 KPI tiles, status chip
 * strip, table) and wired to useLeaks — KPIs come from `kpis`, rows from
 * `items`, the per-row follow-up pill + "No call" cell derive from
 * `follow_up_status` / `last_call_after_escalation_at`, and the client renders
 * as a #id link to the client page.
 */

import { describe, expect, it, vi } from 'vitest'
import { render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The client cell renders a client-page link, so the component needs a Router.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { active_project_id: number } }) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

vi.mock('@/features/training/hooks/useExportLeaks', () => ({
  useExportLeaks: () => ({ mutate: vi.fn(), isPending: false }),
}))

const leaksMock = vi.hoisted(() => ({
  data: {
    kpis: { total_escalations: 3, not_followed_up: 2, followed_up: 1 },
    items: [
      {
        id: 1,
        escalation_date: '2026-05-13T10:05:00',
        operator_id: 41,
        operator_name: 'Denys Polyakov',
        client_id: 236200,
        client_full_name: 'Smith Alice',
        agreement_id: 7519,
        contract_number: 'D-7519',
        promise_amount: '5000.00',
        promise_date: '2026-05-13T00:00:00',
        follow_up_status: 'not_followed_up',
        last_call_after_escalation_at: null,
      },
      {
        id: 2,
        escalation_date: '2026-05-13T09:00:00',
        operator_id: 42,
        operator_name: 'Artem Honchar',
        client_id: 239800,
        client_full_name: 'Jones Bob',
        agreement_id: 7890,
        contract_number: 'D-7890',
        promise_amount: '3200.00',
        promise_date: '2026-05-13T00:00:00',
        follow_up_status: 'followed_up',
        last_call_after_escalation_at: '2026-05-13T12:10:00',
      },
    ],
    total: 2,
    page: 1,
    page_size: 50,
  },
  isLoading: false,
  isError: false,
}))
vi.mock('@/features/training/hooks/useLeaks', () => ({
  useLeaks: () => leaksMock,
}))

import { LeaksSubTab } from '../LeaksSubTab'

describe('LeaksSubTab', () => {
  it('renders the 3 KPI counters from the BE kpis block', () => {
    render(<LeaksSubTab />)
    // Each count surfaces in BOTH a KPI tile and a status chip badge
    // (total_escalations / not_followed_up / followed_up = 3 / 2 / 1).
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1)
  })

  it('renders one row per BE item with the resolved operator name', () => {
    render(<LeaksSubTab />)
    expect(screen.getByText('Denys Polyakov')).toBeInTheDocument()
    expect(screen.getByText('Artem Honchar')).toBeInTheDocument()
  })

  it('renders the client as a #id link, with the name OUT of the title (KAN-KB-54)', () => {
    // The hover-reveal moved from `title` into a tooltip: Radix renders its
    // content as a text node, which OpenReplay masks, whereas an attribute is
    // sent verbatim.
    render(<LeaksSubTab />)
    const clientLink = screen.getByRole('button', { name: '#236200' })
    expect(clientLink).not.toHaveAttribute('title')
  })

  it('renders the contract code in the Agreement column', () => {
    render(<LeaksSubTab />)
    expect(screen.getByText('D-7519')).toBeInTheDocument()
  })

  it('shows "No call" for a not-followed-up escalation and a timestamp for a followed-up one', () => {
    render(<LeaksSubTab />)
    expect(screen.getByText('pages.training.leaks.noCall')).toBeInTheDocument()
    // last_call_after_escalation_at is now locale-aware (mocked i18n = en → MM/DD HH:mm).
    expect(screen.getByText('05/13 12:10')).toBeInTheDocument()
  })

  it('renders the escalation info banner (the BE escalation definition)', () => {
    render(<LeaksSubTab />)
    expect(screen.getByText(/pages\.training\.leaks\.ruleBanner/)).toBeInTheDocument()
  })
})
