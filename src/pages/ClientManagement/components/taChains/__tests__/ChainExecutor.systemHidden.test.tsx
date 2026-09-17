/**
 * KAN-1045 — a System (hidden) chain must not reach the operator.
 *
 * Renders the real ChainExecutor in the situation the ticket reports: a client
 * who has one active instance of the seeded `email_confirmed` chain, which is
 * `chain_type: 'automatic'` + `is_system_hidden: true` (migration 130; verified
 * against ta_chains id 21 in the local DB).
 *
 * Before the fix all four assertions below held the other way round — the
 * picker vanished and the operator was left holding a system form with a Save
 * button under it. The control case is what makes that conclusive: same
 * component, same mocks, same available manual chain; only the stuck instance
 * differs.
 */
import { describe, expect, it, vi, afterAll, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/** The seeded system chain, copied from migration 130. */
const hiddenChain = {
  id: 21,
  name: 'Legal Workplace — email confirmed',
  description: null,
  chain_type: 'automatic',
  department_ids: [1],
  is_active: true,
  is_system_hidden: true,
  is_pinned: false,
  step_count: 1,
  created_by: null,
  created_at: '',
  updated_at: '',
  steps: [
    {
      id: 210,
      chain_id: 21,
      target_action_id: 3,
      target_action_name: 'Legal letter confirmed (system)',
      target_action_field_type: 'dropdown',
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

/**
 * Manual AND System (hidden). KAN-318 makes the two settings independent, so
 * this combination is legal — and it is the only fixture that isolates the
 * visibility axis: anything `automatic` is already excluded by chain type, so
 * a hidden automatic chain cannot prove the visibility filter does anything.
 */
const hiddenManualChain = {
  ...hiddenChain,
  id: 30,
  name: 'System bookkeeping (manual, hidden)',
  chain_type: 'manual',
  steps: [{ ...hiddenChain.steps[0], id: 300, chain_id: 30 }],
}

/** An ordinary chain the operator is entitled to pick. */
const manualChain = {
  ...hiddenChain,
  id: 1,
  name: 'Ordinary call',
  chain_type: 'manual',
  is_system_hidden: false,
  steps: [{ ...hiddenChain.steps[0], id: 10, chain_id: 1 }],
}

/** The instance left behind by the robot run. */
const stuckInstance = {
  id: 9,
  chain_id: 21,
  // Sent by the instance endpoint since KAN-1045 — this is what lets the card
  // tell a system chain apart from the operator's own unfinished work.
  chain_type: 'automatic',
  is_system_hidden: true,
  client_id: 100,
  status: 'active',
  current_step_order: 1,
  step_data: {},
  started_by: null,
  created_at: '',
  updated_at: '',
}

const state = { instances: [stuckInstance] as unknown[] }

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useStartChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTAInteraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdvanceChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClientChainInstances: () => ({ data: state.instances, isLoading: false }),
  useCancelChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClientPinnedChainIds: () => ({ data: [] }),
  useRewindChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  // The hidden chain is in this payload on purpose. The server now withholds
  // it from operators (ta_chains.py), but an admin still receives it for the
  // settings screen — so the component must not rely on that filter alone.
  useTAChains: () => ({
    data: { items: [manualChain, hiddenChain, hiddenManualChain] },
    isLoading: false,
  }),
  useTAChain: () => ({ data: hiddenChain }),
  usePinTAChain: () => ({ mutateAsync: vi.fn() }),
  useUnpinTAChain: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({
    data: {
      items: [
        {
          id: 3,
          name: 'Результат',
          field_type: 'dropdown',
          is_hidden: false,
          dropdown_values: [{ id: 7, value: 'Домовленість', sort_order: 0, is_hidden: false }],
        },
      ],
    },
  }),
}))
vi.mock('@/features/chainBuilder/hooks/useChainBuilder', () => ({
  useBuilderData: () => ({ data: { branches: [], effects: [], blockers: [] } }),
}))
vi.mock('@/features/quickPicks/hooks/useQuickPicks', () => ({
  useQuickPicks: () => ({ data: [] }),
}))
vi.mock('@/features/tags/hooks/useTags', () => ({ useTags: () => ({ data: [] }) }))
vi.mock('@/features/clients/hooks/useClientEmails', () => ({
  useClientEmails: () => ({ data: [] }),
}))
vi.mock('@/features/clients/hooks/useClientPhones', () => ({
  useClientPhones: () => ({ data: [] }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: (s: unknown) => unknown) => {
    const s = { user: { active_project_id: '1', timezone: 'Europe/Kiev' } }
    return sel ? sel(s) : s
  },
}))
vi.mock('@/stores/chainExecutorStore', () => ({
  useChainExecutorStore: Object.assign(
    (sel?: (s: unknown) => unknown) => {
      const s = { minimized: null, setMinimized: vi.fn(), clear: vi.fn() }
      return sel ? sel(s) : s
    },
    { getState: () => ({ minimized: null }) }
  ),
}))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (k: string, d?: unknown) => (typeof d === 'string' ? d : k),
      i18n: { language: 'en' },
    }),
  }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { ChainExecutor } from '../ChainExecutor'

const originals = {
  scrollIntoView: Element.prototype.scrollIntoView,
  hasPointerCapture: Element.prototype.hasPointerCapture,
  releasePointerCapture: Element.prototype.releasePointerCapture,
  setPointerCapture: Element.prototype.setPointerCapture,
  getClientRects: Element.prototype.getClientRects,
}
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.getClientRects = vi.fn(
    () => [{ width: 100, height: 100 }] as unknown as DOMRectList
  )
})
afterAll(() => {
  Object.assign(Element.prototype, originals)
})
beforeEach(() => {
  state.instances = [stuckInstance]
})

const PICKER = 'pages.clientChains.selectChainPlaceholder'

describe('KAN-1045 — a system-hidden chain must not reach the operator', () => {
  it('CONTROL: with no active instance the operator gets the normal picker', () => {
    state.instances = []
    render(<ChainExecutor clientId={100} clientName="Test client" />)

    expect(screen.getByText(PICKER)).toBeInTheDocument()
    expect(screen.queryByText(hiddenChain.name)).not.toBeInTheDocument()
  })

  it('never shows the name of a chain whose visibility is System (hidden)', () => {
    render(<ChainExecutor clientId={100} clientName="Test client" />)

    expect(screen.queryByText(hiddenChain.name)).not.toBeInTheDocument()
  })

  it('leaves the picker in place, so the operator can still log a real call', () => {
    render(<ChainExecutor clientId={100} clientName="Test client" />)

    // The whole complaint in the ticket: the selection step was being skipped.
    expect(screen.getByText(PICKER)).toBeInTheDocument()
  })

  it('offers no Save button for it', () => {
    render(<ChainExecutor clientId={100} clientName="Test client" />)

    // The submit that used to fail: create_task is configured
    // assignee_mode=event_assignee, and a manual save carries no email event.
    expect(screen.queryByRole('button', { name: /saveInteraction/i })).not.toBeInTheDocument()
  })

  it('keeps a system-hidden chain out of the picker list as well', async () => {
    // Belt and braces for an admin, who legitimately receives hidden chains
    // from the list endpoint and could otherwise be offered one to launch.
    // The names live inside the dropdown, so it has to be opened to see them.
    const user = userEvent.setup()
    state.instances = []
    render(<ChainExecutor clientId={100} clientName="Test client" />)

    await user.click(screen.getByText(PICKER))

    expect(await screen.findByText(manualChain.name)).toBeInTheDocument()
    expect(screen.queryByText(hiddenManualChain.name)).not.toBeInTheDocument()
    expect(screen.queryByText(hiddenChain.name)).not.toBeInTheDocument()
  })

  it("still adopts an ordinary active instance as the operator's own work", () => {
    // The guard must not swallow the normal case: an operator who left a
    // manual chain half-finished must land back in it, picker skipped.
    state.instances = [
      { ...stuckInstance, chain_id: 1, chain_type: 'manual', is_system_hidden: false },
    ]
    render(<ChainExecutor clientId={100} clientName="Test client" />)

    expect(screen.getByText(manualChain.name)).toBeInTheDocument()
    expect(screen.queryByText(PICKER)).not.toBeInTheDocument()
  })
})
