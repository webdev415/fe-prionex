/**
 * KAN-1110 — the component wiring for the five-minute self-edit window.
 *
 * The pure decision (`canMutateInteraction`) and the clock (`useNowUntil`) are
 * covered by their own files. What only this level can catch is the wiring
 * between them, and it is the part most likely to rot silently:
 *
 *   - `user.id` is a STRING on the auth store while `recorded_by` is a number,
 *     so the comparison has to parse. Get it wrong and every row looks like
 *     somebody else's — the feature quietly reverts to permission-only and no
 *     other test notices.
 *   - `lastOwnSelfEditExpiry` decides whether a timer starts at all. Reduce it
 *     wrongly and the buttons never disappear.
 *
 * The user here holds NEITHER permission, which is the only configuration in
 * which the window decides anything.
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const NOW = Date.parse('2026-05-11T14:00:00Z')
const ME = 5
const SOMEONE_ELSE = 6

/** The API sends these naive (no zone marker) — the shape that matters. */
const naive = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, '')

function interaction(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    client_id: 100,
    credit_id: null,
    chain_id: 1,
    chain_name: 'Chain',
    chain_instance_id: 9,
    leaf_node_id: null,
    leaf_node_name: null,
    dropdown_value_id: null,
    dropdown_value_name: null,
    dictionary_path: [],
    promise_date: null,
    promise_amount: null,
    notes: null,
    step_data: { '1': 'RES' },
    recorded_by: ME,
    recorded_by_name: 'op',
    recorded_by_full_name: null,
    call_id: null,
    assigned_operator_id: null,
    assigned_operator_name: null,
    current_responsible_id: null,
    current_responsible_name: null,
    created_at: '2026-05-11T13:58:00',
    archived: false,
    is_pinned: false,
    pinned_at: null,
    // Three minutes in: still inside the window.
    self_edit_expires_at: naive(NOW + 3 * 60_000),
    ...over,
  }
}

const rows: Array<ReturnType<typeof interaction>> = [interaction()]

const chain = {
  id: 1,
  name: 'Chain',
  description: null,
  chain_type: 'manual',
  department_ids: [1],
  is_active: true,
  is_system_hidden: false,
  is_pinned: false,
  step_count: 1,
  created_by: 1,
  created_at: '',
  updated_at: '',
  steps: [
    {
      id: 11,
      chain_id: 1,
      target_action_id: 3,
      target_action_name: 'Result',
      target_action_field_type: 'text',
      step_order: 1,
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

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useClientTAInteractions: () => ({
    data: { items: rows, total_count: rows.length, total: rows.length },
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
  useTargetActions: () => ({
    data: {
      items: [{ id: 3, name: 'Result', field_type: 'text', is_hidden: false, dropdown_values: [] }],
    },
  }),
}))
vi.mock('@/features/users/hooks/useUsers', () => ({ useOperators: () => ({ data: [] }) }))
// `id` is a STRING here on purpose — that is what the real store holds.
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: unknown }) => unknown) =>
    sel({ user: { id: String(ME), active_project_id: '1', username: 'ab' } }),
}))
// Neither edit nor delete permission: the window is the only thing deciding.
vi.mock('@/hooks', () => ({ useHasPermission: () => false }))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({ t: (k: string, d?: string) => d ?? k, i18n: { language: 'en' } }),
  }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/components/auth', () => ({
  PermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../EditTAInteractionModal', () => ({ EditTAInteractionModal: () => null }))
vi.mock('@/components/ui/Pagination', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/ui/Pagination')>()),
  Pagination: () => null,
}))
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

const editButton = () => screen.queryByRole('button', { name: /editInteraction|edit/i })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  rows.splice(0, rows.length, interaction())
})
afterEach(() => {
  vi.useRealTimers()
})

describe('TAInteractionHistory — self-edit window wiring', () => {
  it('shows Edit on my own fresh row even with no permission', () => {
    render(<TAInteractionHistory clientId={100} debts={[]} />)
    expect(editButton()).toBeTruthy()
  })

  it('takes Edit away on its own once the window passes', () => {
    render(<TAInteractionHistory clientId={100} debts={[]} />)
    expect(editButton()).toBeTruthy()

    // No refetch, no click — the ticking clock alone must remove it. act() so
    // React flushes the state the interval sets.
    act(() => {
      vi.advanceTimersByTime(4 * 60_000)
    })

    expect(editButton()).toBeNull()
  })

  it('never shows Edit on somebody else’s row, however fresh', () => {
    rows.splice(0, rows.length, interaction({ recorded_by: SOMEONE_ELSE }))
    render(<TAInteractionHistory clientId={100} debts={[]} />)
    expect(editButton()).toBeNull()
  })

  it('compares the store’s STRING id against the numeric recorded_by', () => {
    // The store holds '5'; recorded_by is 5. A strict === without parsing makes
    // every row look like someone else's and silently kills the feature.
    rows.splice(0, rows.length, interaction({ recorded_by: ME }))
    render(<TAInteractionHistory clientId={100} debts={[]} />)
    expect(editButton()).toBeTruthy()
  })

  it('shows nothing for a row whose window has already closed', () => {
    rows.splice(0, rows.length, interaction({ self_edit_expires_at: naive(NOW - 60_000) }))
    render(<TAInteractionHistory clientId={100} debts={[]} />)
    expect(editButton()).toBeNull()
  })

  it('judges each row by its own expiry, not by the newest', () => {
    rows.splice(
      0,
      rows.length,
      interaction({ id: 1, self_edit_expires_at: naive(NOW - 60_000) }), // closed
      interaction({ id: 2, self_edit_expires_at: naive(NOW + 4 * 60_000) }) // open
    )
    render(<TAInteractionHistory clientId={100} debts={[]} />)
    // Exactly one row offers the button — the open one.
    expect(screen.queryAllByRole('button', { name: /editInteraction|edit/i })).toHaveLength(1)
  })
})
