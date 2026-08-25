/**
 * KAN-973 — the hotkey auto-start must not revive after the operator acts.
 *
 * Press a hotkey on a client who already has a chain running and the launch is
 * correctly skipped — but `initialTemplateId` stays set and the modal stays
 * open. Cancelling that instance does not close the modal, so when
 * `activeInstance` flips to null the effect re-evaluates. Latching only on a
 * *successful* start let it fire there: the hotkey's chain began by itself,
 * with a success toast, from an action nobody took.
 *
 * The rule it consults is pure and was never wrong; the defect was in the
 * caller's ref, so only a rendered component can pin it.
 */
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const startInstance = vi.fn().mockResolvedValue({ id: 99 })

const chain = {
  id: 1,
  name: 'One step chain',
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
      id: 10,
      chain_id: 1,
      target_action_id: 3,
      target_action_name: 'Результат',
      target_action_field_type: 'dropdown',
      step_order: 1,
      is_required: false,
      delay_minutes: 0,
      not_in_the_past: false,
      contact_source: null,
      show_closed_credits: false,
      position_x: null,
      position_y: null,
    },
  ],
}

const ACTIVE_INSTANCE = {
  id: 9,
  chain_id: 1,
  client_id: 100,
  status: 'active',
  current_step_order: 1,
  step_data: {},
  created_at: '',
  updated_at: '',
}

// Mutable so a test can clear the instance the way "Cancel chain" does.
const state = { instances: [ACTIVE_INSTANCE] as unknown[] }

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useStartChainInstance: () => ({ mutateAsync: startInstance, isPending: false }),
  useCreateTAInteraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdvanceChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClientChainInstances: () => ({ data: state.instances, isLoading: false }),
  useCancelChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClientPinnedChainIds: () => ({ data: [] }),
  useRewindChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChains: () => ({ data: { items: [chain] }, isLoading: false }),
  useTAChain: () => ({ data: chain }),
  usePinTAChain: () => ({ mutateAsync: vi.fn() }),
  useUnpinTAChain: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/features/quickPicks/hooks/useQuickPicks', () => ({
  useQuickPicks: () => ({
    data: [
      {
        id: 12,
        chain_id: 1,
        chain_name: 'One step chain',
        name: 'Bound template',
        department_ids: [1],
        sort_order: 1,
        preset_values: null,
      },
    ],
  }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({
    data: {
      items: [
        { id: 3, name: 'Результат', field_type: 'dropdown', is_hidden: false, dropdown_values: [] },
      ],
    },
  }),
}))
vi.mock('@/features/chainBuilder/hooks/useChainBuilder', () => ({
  useBuilderData: () => ({ data: { branches: [], effects: [], blockers: [] } }),
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
    const s = {
      user: { active_project_id: '1', timezone: 'Europe/Kiev', permissions: ['manage_settings'] },
    }
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

const originals = { scrollIntoView: Element.prototype.scrollIntoView }
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
afterAll(() => Object.assign(Element.prototype, originals))

beforeEach(() => {
  startInstance.mockClear()
  state.instances = [ACTIVE_INSTANCE]
})

describe('ChainExecutor hotkey auto-start', () => {
  it('does not start the hotkey chain when an instance is already running', async () => {
    render(<ChainExecutor clientId={100} clientName="Test" initialTemplateId={12} />)
    await waitFor(() => expect(screen.getByText(/logInteraction/i)).toBeInTheDocument())
    expect(startInstance).not.toHaveBeenCalled()
  })

  it('still does not start it after that instance is cleared', async () => {
    const { rerender } = render(
      <ChainExecutor clientId={100} clientName="Test" initialTemplateId={12} />
    )
    await waitFor(() => expect(screen.getByText(/logInteraction/i)).toBeInTheDocument())
    expect(startInstance).not.toHaveBeenCalled()

    // What "Cancel chain" does: the instance goes away, the modal stays open.
    state.instances = []
    rerender(<ChainExecutor clientId={100} clientName="Test" initialTemplateId={12} />)

    // The decision was already settled as "no" for this opening of the modal.
    // Starting here would begin a chain the operator never asked for.
    await waitFor(() => expect(screen.getByText(/logInteraction/i)).toBeInTheDocument())
    expect(startInstance).not.toHaveBeenCalled()
  })

  it('does start when there was no active instance to begin with', async () => {
    // The latch must not be so eager that it blocks the normal case.
    state.instances = []
    render(<ChainExecutor clientId={100} clientName="Test" initialTemplateId={12} />)
    await waitFor(() => expect(startInstance).toHaveBeenCalledTimes(1))
    expect(startInstance).toHaveBeenCalledWith({ chain_id: 1, client_id: 100 })
  })
})
