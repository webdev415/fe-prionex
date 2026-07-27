/**
 * Regression test: the client profile blanked with "Something went wrong"
 * (minified React error #31 — "Objects are not valid as a React child") when
 * an interaction's ``step_data`` values were rich objects
 * ``{value, autofilled, target_action_id, target_action_name}`` written by the
 * chain-autofill feature, AND the interaction's chain had no ordered steps
 * (deleted/not loaded), which routes the Result column through its fallback
 * branch. That branch used to render the raw object; it must unwrap ``.value``.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Chain is FOUND but has no steps → forces the Result column's fallback branch
// (the one that iterates the interaction's own step_data).
const chain = {
  id: 1,
  name: 'Autofilled chain',
  description: null,
  chain_type: 'manual',
  department_ids: [1],
  is_active: true,
  is_system_hidden: false,
  is_pinned: false,
  step_count: 0,
  created_by: 1,
  created_at: '',
  updated_at: '',
  steps: [],
}

// step_data values are the rich autofill shape seen in production.
const interaction = {
  id: 1,
  client_id: 100,
  credit_id: null,
  chain_id: 1,
  chain_name: 'Autofilled chain',
  chain_instance_id: null,
  leaf_node_id: null,
  leaf_node_name: null,
  dropdown_value_id: null,
  dropdown_value_name: null,
  dictionary_path: [],
  promise_date: null,
  promise_amount: null,
  notes: null,
  step_data: {
    '1': {
      value: '2026-07-02T05:27:05.864426+00:00',
      autofilled: true,
      target_action_id: 24,
      target_action_name: 'Date',
    },
    '2': { value: '24428', autofilled: true, target_action_id: 23, target_action_name: 'Credit' },
  },
  recorded_by: 5,
  recorded_by_name: 'op',
  recorded_by_full_name: null,
  call_id: null,
  assigned_operator_id: null,
  assigned_operator_name: null,
  current_responsible_id: null,
  current_responsible_name: null,
  created_at: '2026-07-02T05:27:00',
  archived: false,
  is_pinned: false,
  pinned_at: null,
}

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useClientTAInteractions: () => ({
    data: { items: [interaction], total_count: 1, total: 1 },
    isLoading: false,
  }),
  useClientChainInstances: () => ({ data: [] }),
  useDeleteTAInteraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTogglePinTAInteraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChains: () => ({ data: { items: [chain] } }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({ data: { items: [] } }),
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

describe('TAInteractionHistory — rich autofilled step_data (React #31 regression)', () => {
  it('renders without throwing and unwraps the object value', () => {
    const debts = [{ id: 24428, contract_number: '24428' }]

    // Pre-fix this render throws (React error #31) and blanks the profile.
    const { container } = render(<TAInteractionHistory clientId={100} debts={debts} />)

    // The inner .value is unwrapped and shown; the raw object never leaks.
    expect(container.textContent).toContain('24428')
    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent).not.toContain('autofilled')
    expect(screen.queryByText('Something went wrong')).toBeNull()
  })
})
