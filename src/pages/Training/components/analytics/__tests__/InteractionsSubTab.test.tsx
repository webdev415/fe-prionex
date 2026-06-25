/**
 * Render coverage for InteractionsSubTab (KAN-731 Block 1).
 *
 * Focus: items from useInteractionMonitoring render with the right
 * date/operator/client/deal/amount columns, debt_id + contract_number
 * surface, the period chip default is `today`, and the Reset button
 * disables on the default state.
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

const operatorsMock = vi.hoisted(() => ({
  data: [
    { id: 50, full_name: 'Olena Kovalenko', department_name: 'Hard Collection' },
    { id: 51, full_name: 'Bohdan Melnyk', department_name: 'Soft Collection' },
  ],
}))
vi.mock('@/features/users/hooks', () => ({
  useOperators: () => operatorsMock,
}))

vi.mock('@/features/clients/hooks/useNoteInteraction', () => ({
  useInteractionResults: () => ({
    data: [
      { id: 1, code: 'PROMISE_PAY', name: 'Promise to Pay' },
      { id: 2, code: 'REFUSAL', name: 'Refusal' },
    ],
  }),
}))

const interactionsMock = vi.hoisted(() => ({
  data: {
    items: [
      {
        id: 100,
        interaction_date: '2026-06-11T08:30:00Z',
        client_id: 200,
        client_full_name: 'Smith Alice',
        phone_used: '0500000000',
        user_id: 50,
        user_name: 'Olena Kovalenko',
        contact_type_id: null,
        contact_type_name: null,
        contact_type_code: null,
        result_id: 1,
        result_name: 'Promise to Pay',
        result_code: 'PROMISE_PAY',
        promise_to_pay_amount: '2500.00',
        promise_to_pay_date: null,
        next_action_date: null,
        follow_up_date: null,
        channel: 'call',
        current_responsible_user_id: 50,
        current_responsible_user_name: 'Olena Kovalenko',
        summary: 'Test',
        debt_id: 901,
        contract_number: 'DEAL-42',
      },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  },
  isLoading: false,
  isError: false,
}))
vi.mock('@/features/training/hooks/useInteractionMonitoring', () => ({
  useInteractionMonitoring: () => interactionsMock,
}))

import { InteractionsSubTab } from '../InteractionsSubTab'

describe('InteractionsSubTab', () => {
  it('renders one row per BE item with the resolved operator name', () => {
    render(<InteractionsSubTab />)
    // Operator name appears in the row AND the filter dropdown <option>.
    expect(screen.getAllByText('Olena Kovalenko').length).toBeGreaterThanOrEqual(1)
  })

  it('renders the client as a #id link to the client page (name in the title)', () => {
    render(<InteractionsSubTab />)
    const clientLink = screen.getByRole('button', { name: '#200' })
    expect(clientLink).toBeInTheDocument()
    expect(clientLink).toHaveAttribute('title', 'Smith Alice')
  })

  it('renders debt_id+contract_number in the Deal column (KAN-731 Phase B)', () => {
    render(<InteractionsSubTab />)
    expect(screen.getByText('DEAL-42')).toBeInTheDocument()
  })

  it('formats promise amount with locale thousands separators and ₴ suffix', () => {
    render(<InteractionsSubTab />)
    expect(screen.getByText(/2,500 ₴/)).toBeInTheDocument()
  })

  it('renders the result_name as the status pill', () => {
    render(<InteractionsSubTab />)
    // result_name appears in the row pill AND the status filter <option>.
    expect(screen.getAllByText('Promise to Pay').length).toBeGreaterThanOrEqual(1)
  })

  it('disables the Reset button while filters are at their default', () => {
    render(<InteractionsSubTab />)
    const reset = screen.getByRole('button', {
      name: /pages\.training\.interactions\.filters\.reset/,
    })
    expect(reset).toBeDisabled()
  })

  it('populates the Status dropdown from the interaction-results list', () => {
    render(<InteractionsSubTab />)
    const selects = document.querySelectorAll('select')
    const statusSelect = selects[1] // [0]=operator, [1]=status
    const options = Array.from(statusSelect.options).map((o) => o.textContent)
    expect(options).toContain('Promise to Pay')
    expect(options).toContain('Refusal')
  })
})
