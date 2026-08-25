/**
 * KAN-973 — ``prefilledPhoneSource`` must seed WITHOUT narrowing.
 *
 * The hotkey resolves the number of a call that just ended and wants it
 * pre-selected. Feeding that through ``contactSource`` (the phone-row prop)
 * also filters the chain list, and a template whose contact step belongs to the
 * other source then disappears — including, in the reported case, the very
 * template the hotkey was bound to. ``prefilledPhoneSource`` exists to split
 * those two effects apart.
 *
 * Nothing pinned that split, so a refactor collapsing the props back into one
 * would restore the bug with a green suite. These tests are the distinction:
 * the same source value, passed through each prop, must produce different chain
 * lists.
 */
import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const startInstance = vi.fn().mockResolvedValue({ id: 99 })

const makeChain = (id: number, name: string, contactSource: 'client' | 'recommender') => ({
  id,
  name,
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
      id: id * 10,
      chain_id: id,
      target_action_id: 3,
      target_action_name: 'Контакт',
      target_action_field_type: 'contact',
      step_order: 1,
      is_required: false,
      delay_minutes: 0,
      not_in_the_past: false,
      contact_source: contactSource,
      show_closed_credits: false,
      position_x: null,
      position_y: null,
    },
  ],
})

// Only CLIENT_CHAIN's step is a 'client' contact step, so a 'recommender'
// source filters it out — if the source is allowed to filter at all.
const CLIENT_CHAIN = makeChain(1, 'Client phone chain', 'client')
const REC_CHAIN = makeChain(2, 'Recommender phone chain', 'recommender')

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useStartChainInstance: () => ({ mutateAsync: startInstance, isPending: false }),
  useCreateTAInteraction: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdvanceChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClientChainInstances: () => ({ data: [], isLoading: false }),
  useCancelChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClientPinnedChainIds: () => ({ data: [] }),
  useRewindChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChains: () => ({ data: { items: [CLIENT_CHAIN, REC_CHAIN] }, isLoading: false }),
  useTAChain: () => ({ data: CLIENT_CHAIN }),
  usePinTAChain: () => ({ mutateAsync: vi.fn() }),
  useUnpinTAChain: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('@/features/quickPicks/hooks/useQuickPicks', () => ({
  useQuickPicks: () => ({
    data: [
      {
        id: 12,
        chain_id: 1,
        chain_name: 'Client phone chain',
        name: 'Client quick pick',
        department_ids: [1],
        sort_order: 1,
        preset_values: null,
      },
      {
        id: 13,
        chain_id: 2,
        chain_name: 'Recommender phone chain',
        name: 'Recommender quick pick',
        department_ids: [1],
        sort_order: 2,
        preset_values: null,
      },
    ],
  }),
}))
vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({
    data: {
      items: [
        { id: 3, name: 'Контакт', field_type: 'contact', is_hidden: false, dropdown_values: [] },
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
// TWO phones, deliberately. With one, KAN-977's single-candidate auto-select
// checks it on its own and a seeding assertion passes whether or not the
// prefill did anything — verified: with a single phone this test survived the
// prop being collapsed away entirely.
vi.mock('@/features/clients/hooks/useClientPhones', () => ({
  useClientPhones: () => ({
    data: [
      { id: 1, contact_value: '+380501112233', comment: null, contact_type_id: 7 },
      { id: 2, contact_value: '+380509998877', comment: null, contact_type_id: 7 },
    ],
  }),
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

const originals = {
  scrollIntoView: Element.prototype.scrollIntoView,
  hasPointerCapture: Element.prototype.hasPointerCapture,
  setPointerCapture: Element.prototype.setPointerCapture,
  releasePointerCapture: Element.prototype.releasePointerCapture,
}
beforeAll(() => {
  // Radix's DropdownMenu drives itself off pointer capture, which jsdom does
  // not implement; without these the trigger never opens and every assertion
  // below would pass or fail for the wrong reason.
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})
afterAll(() => Object.assign(Element.prototype, originals))

beforeEach(() => startInstance.mockClear())

const PHONE = '+380501112233'

const renderExecutor = (props: Record<string, unknown>) =>
  render(<ChainExecutor clientId={100} clientName="Test" prefilledPhone={PHONE} {...props} />)

/** Open the chain dropdown and return the names it offers. */
const chainNames = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByText('pages.clientChains.selectChainPlaceholder'))
  await waitFor(() => expect(screen.getByPlaceholderText('Search chains…')).toBeInTheDocument())
  return {
    client: screen.queryByText('Client phone chain'),
    recommender: screen.queryByText('Recommender phone chain'),
  }
}

describe('ChainExecutor prefilledPhoneSource', () => {
  it('leaves the chain list intact when only the prefill source is set', async () => {
    // The regression: the hotkey resolved a 'recommender' number and the
    // client-phone template it was bound to vanished from the picker.
    renderExecutor({ prefilledPhoneSource: 'recommender' })

    const names = await chainNames()
    expect(names.recommender).toBeInTheDocument()
    expect(names.client).toBeInTheDocument()
  })

  it('narrows the chain list when the same value is passed as contactSource', async () => {
    // The inverse, and the reason the two props cannot be collapsed back into
    // one: identical source value, opposite effect on the list.
    renderExecutor({ contactSource: 'recommender' })

    const names = await chainNames()
    expect(names.recommender).toBeInTheDocument()
    expect(names.client).not.toBeInTheDocument()
  })

  it('seeds the phone into the contact step that matches the prefill source', async () => {
    // The other half of the prop's job: narrowing nothing must not mean
    // seeding nothing.
    renderExecutor({ prefilledPhoneSource: 'recommender' })

    const user = userEvent.setup()
    await user.click(screen.getByText('pages.clientChains.selectChainPlaceholder'))
    await waitFor(() => expect(screen.getByText('Recommender phone chain')).toBeInTheDocument())
    await user.click(screen.getByText('Recommender phone chain'))

    // The resolved number is the one checked — not merely "something is".
    await waitFor(() => expect(screen.getByRole('radio', { name: /380501112233/ })).toBeChecked())
    expect(screen.getByRole('radio', { name: /380509998877/ })).not.toBeChecked()
  })
})
