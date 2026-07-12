/**
 * Render test for the Notes-expand ⇄ Result-truncate behaviour.
 *
 * Bug: expanding a long note left the Result column at full width, so the Notes
 * column got squeezed to 2–3 characters per line (or overflowed). Fix: while any
 * note is expanded the Result column caps its width and truncates with an
 * ellipsis, and the Notes column gets a min-width + word-wrapping.
 *
 * jsdom doesn't compute pixel layout, so this asserts the *mechanism*: expanding
 * toggles the truncation/min-width classes on, collapsing toggles them off, and
 * the full note text is revealed only when expanded.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const LONG_NOTE = Array(30).fill('lorem').join(' ') + ' ENDMARKER'

const interaction = {
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
  notes: LONG_NOTE,
  // One text step so the Result column renders a distinctive value ("RES").
  step_data: { '1': 'RES' },
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

const targetActions = [
  { id: 3, name: 'Result', field_type: 'text', is_hidden: false, dropdown_values: [] },
]

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

/** True if any element in the tree carries the given (literal) class token. */
function hasClass(root: HTMLElement, cls: string): boolean {
  return Array.from(root.querySelectorAll('*')).some(
    (el) =>
      typeof (el as HTMLElement).className === 'string' &&
      (el as HTMLElement).className.includes(cls)
  )
}

describe('TAInteractionHistory — Notes expand ⇄ Result truncate', () => {
  it('truncates Result and widens Notes only while a note is expanded', () => {
    const { container } = render(<TAInteractionHistory clientId={100} debts={[]} />)

    // Collapsed initial state: Result is NOT capped, the Notes column is not at
    // its expanded width, the tail is hidden, and the preview is a single-line
    // clipped element (``truncate``) — never a multi-line sliver.
    expect(hasClass(container, 'max-w-[240px]')).toBe(false)
    expect(hasClass(container, 'min-w-[320px]')).toBe(false)
    expect(screen.queryByText((t) => t.includes('ENDMARKER'))).toBeNull()
    // The collapsed preview text sits inside a truncating (single-line) span.
    const previewEl = screen.getByText((t) => t.startsWith('lorem') && t.endsWith('...'))
    expect(previewEl.className).toContain('truncate')

    // Expand the note.
    const expandBtn = screen.getByRole('button', { name: /showFullNote/i })
    fireEvent.click(expandBtn)

    // Result is now capped + truncated; Notes column gets its min-width; the
    // full note (with the tail marker) is revealed.
    expect(hasClass(container, 'max-w-[240px]')).toBe(true)
    expect(hasClass(container, 'truncate')).toBe(true)
    expect(hasClass(container, 'min-w-[320px]')).toBe(true)
    expect(screen.getByText((t) => t.includes('ENDMARKER'))).toBeTruthy()

    // Collapse again → truncation and min-width come back off.
    const collapseBtn = screen.getByRole('button', { name: /hideFullNote/i })
    fireEvent.click(collapseBtn)
    expect(hasClass(container, 'max-w-[240px]')).toBe(false)
    expect(hasClass(container, 'min-w-[320px]')).toBe(false)
  })
})
