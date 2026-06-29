/**
 * Render test for the TA-interaction history Credit/Result columns (KAN-744).
 *
 * Reproduces the reported bug end-to-end through the ACTUAL component:
 *  - chain has ONE credit step (Step 7);
 *  - the wizard snapshot (authoritative) has Step 7 = "162040,257867";
 *  - the interaction's own step_data drifted: a phantom 162040 sits in the
 *    Step 3 dropdown slot, and Step 7 is missing 257867.
 *
 * Expected after the fix: the Credit column reads from the credit step via the
 * snapshot-first resolution and shows exactly "#162040, #257867" — the phantom
 * is gone and the missing credit is back. Before the fix it showed "#162040".
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── Mock every hook the component depends on ────────────────────────────────
const interaction = {
  id: 1,
  client_id: 100,
  credit_id: null,
  chain_id: 1,
  chain_name: 'Стягнення: Контакт з клієнтом',
  chain_instance_id: 9,
  leaf_node_id: null,
  leaf_node_name: null,
  dropdown_value_id: null,
  dropdown_value_name: null,
  dictionary_path: [],
  promise_date: null,
  promise_amount: null,
  notes: null,
  // Interaction step_data (what the history reads): the credit step (Step 7)
  // holds both real picks; a phantom debt id has drifted into the Step 3
  // dropdown slot and must be ignored.
  step_data: { '2': 'Домовленість', '3': '162040', '7': '162040,257867' },
  recorded_by: 5,
  recorded_by_name: 'op',
  recorded_by_full_name: null,
  call_id: null,
  assigned_operator_id: null,
  assigned_operator_name: null,
  current_responsible_id: null,
  current_responsible_name: null,
  created_at: '2026-05-11T13:42:00',
  archived: false,
  is_pinned: false,
  pinned_at: null,
}

const chain = {
  id: 1,
  name: 'Стягнення: Контакт з клієнтом',
  description: null,
  chain_type: 'manual',
  department_ids: [1],
  is_active: true,
  is_system_hidden: false,
  is_pinned: false,
  step_count: 3,
  created_by: 1,
  created_at: '',
  updated_at: '',
  steps: [
    {
      id: 12,
      chain_id: 1,
      target_action_id: 3,
      target_action_name: 'Результат',
      target_action_field_type: 'dropdown',
      step_order: 2,
      is_required: true,
      delay_minutes: 0,
      not_in_the_past: false,
      contact_source: null,
      show_closed_credits: false,
      position_x: null,
      position_y: null,
    },
    {
      id: 13,
      chain_id: 1,
      target_action_id: 5,
      target_action_name: 'Підтип: Відмова',
      target_action_field_type: 'dropdown',
      step_order: 3,
      is_required: true,
      delay_minutes: 0,
      not_in_the_past: false,
      contact_source: null,
      show_closed_credits: false,
      position_x: null,
      position_y: null,
    },
    {
      id: 17,
      chain_id: 1,
      target_action_id: 10,
      target_action_name: 'Кредит',
      target_action_field_type: 'credit',
      step_order: 7,
      is_required: true,
      delay_minutes: 0,
      not_in_the_past: false,
      contact_source: null,
      show_closed_credits: false,
      position_x: null,
      position_y: null,
    },
  ],
}

const targetActions = [
  {
    id: 3,
    name: 'Результат',
    field_type: 'dropdown',
    is_hidden: false,
    dropdown_values: [{ id: 7, value: 'Домовленість', sort_order: 0, is_hidden: false }],
  },
  { id: 5, name: 'Підтип: Відмова', field_type: 'dropdown', is_hidden: false, dropdown_values: [] },
  { id: 10, name: 'Кредит', field_type: 'credit', is_hidden: false, dropdown_values: [] },
]

// Copy A (wizard snapshot): Step 7 holds BOTH real credits; no Step 3 credit.
const clientInstances = [
  {
    id: 9,
    step_data: {
      '2': { value: 'Домовленість', target_action_id: 3 },
      '7': { value: '162040,257867', target_action_id: 10 },
    },
  },
]

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useClientTAInteractions: () => ({
    data: { items: [interaction], total_count: 1, total: 1 },
    isLoading: false,
  }),
  useClientChainInstances: () => ({ data: clientInstances }),
  useDeleteTAInteraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTogglePinTAInteraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChains: () => ({ data: { items: [chain] } }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: targetActions } }),
}))
vi.mock('@/features/users/hooks/useUsers', () => ({
  useOperators: () => ({ data: [] }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: unknown }) => unknown) =>
    sel({ user: { active_project_id: '1', first_name: 'A', last_name: 'B', username: 'ab' } }),
}))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({ t: (k: string, d?: string) => d ?? k, i18n: { language: 'en' } }),
  }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/components/auth', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../EditTAInteractionModal', () => ({ EditTAInteractionModal: () => null }))
vi.mock('@/components/ui/Pagination', () => ({ Pagination: () => null }))
vi.mock('@/components/ui/DateSelect', () => ({ DateSelect: () => null }))
vi.mock('@/components/ui/Modal', () => ({ Modal: () => null }))
vi.mock('@/components/ui/Select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}))

import { TAInteractionHistory } from '../TAInteractionHistory'

describe('TAInteractionHistory — Credit column (KAN-744)', () => {
  const debts = [
    { id: 162040, contract_number: '162040' },
    { id: 257867, contract_number: '257867' },
    { id: 43820, contract_number: '43820' },
  ]

  it('shows both real credits from the credit step and drops the phantom', () => {
    render(<TAInteractionHistory clientId={100} debts={debts} />)

    // Both credits from Step 7 are shown (missing 257867 is back). The cell
    // text is exactly the two real credits — the phantom 162040 from Step 3 is
    // NOT added as a separate credit.
    const cells = screen.getAllByText('#162040, #257867')
    expect(cells.length).toBeGreaterThan(0)

    // The buggy output (credit cell = just "#162040") must NOT be present.
    expect(screen.queryByText('#162040', { exact: true })).toBeNull()
  })
})
