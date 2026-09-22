/**
 * Shared mock harness for the tests that render the real `ChainExecutor`.
 *
 * The component pulls in a dozen feature hooks, two stores and i18n, so a test
 * that wants to render it has to stub all of them before the import. Two files
 * needed the identical ~140 lines (KAN-974's Enter-to-save and KAN-1067's
 * opening focus) and they had drifted: comments in one described assertions
 * that only existed in the other. One copy, so a knob added for one test is
 * visible to the next reader of both.
 *
 * IMPORT THIS FIRST, before `../ChainExecutor`. `vi.mock` here runs when this
 * module is evaluated, and ES imports evaluate in source order — so the
 * registry is populated before the component (and its hooks) are pulled in.
 *
 * Everything mutable lives on `harness`, read through a getter inside each
 * mock factory rather than captured at module load, so a test can change the
 * world between renders. `resetHarness()` in `beforeEach` puts it back.
 */
import { vi } from 'vitest'

export const createInteraction = vi.fn().mockResolvedValue({ id: 1 })
export const advanceInstance = vi.fn().mockResolvedValue({})

const baseChain = {
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
}

const step = (id: number, order: number, targetActionId: number) => ({
  id,
  chain_id: 1,
  target_action_id: targetActionId,
  target_action_name: 'Результат',
  target_action_field_type: 'dropdown',
  step_order: order,
  is_required: false,
  delay_minutes: 0,
  not_in_the_past: false,
  contact_source: null,
  show_closed_credits: false,
  position_x: null,
  position_y: null,
})

/** The default: one step, so the wizard opens already on its last step. */
export const oneStepChain = { ...baseChain, steps: [step(10, 1, 3)] }

/**
 * Two steps, so step 1 is NOT the last one and no Save button is mounted when
 * the modal opens — the shape KAN-1067's fallback exists for.
 */
export const twoStepChain = {
  ...baseChain,
  name: 'Two step chain',
  step_count: 2,
  steps: [step(10, 1, 3), step(11, 2, 4)],
}

const makeInstance = () => ({
  id: 9,
  chain_id: 1,
  client_id: 100,
  status: 'active',
  current_step_order: 1,
  step_data: {},
  created_at: '',
  updated_at: '',
})

export const harness = {
  /** The chain the executor runs. Swap to `twoStepChain` for a mid-chain open. */
  chain: oneStepChain as typeof oneStepChain | typeof twoStepChain,
  /**
   * The operator's chain list, and whether it is still loading. Both outer
   * render guards — the loading skeleton and the "no chains" message — hang
   * off these, and Enter must not save behind either.
   */
  chains: [oneStepChain] as unknown[],
  isLoadingChains: false,
  /**
   * Mutation pending flags. `canSaveOnEnter` is false while either is true, so
   * flipping one and back is how a test drives the opening-focus effect
   * through a real dependency change.
   */
  createPending: false,
  advancePending: false,
}

export function resetHarness() {
  harness.chain = oneStepChain
  harness.chains = [oneStepChain]
  harness.isLoadingChains = false
  harness.createPending = false
  harness.advancePending = false
  createInteraction.mockClear()
  advanceInstance.mockClear()
  getClientRects.mockClear()
  scrollIntoView.mockClear()
}

vi.mock('@/features/taInteractions/hooks/useTAInteractions', () => ({
  useStartChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTAInteraction: () => ({
    mutateAsync: createInteraction,
    isPending: harness.createPending,
  }),
  useAdvanceChainInstance: () => ({
    mutateAsync: advanceInstance,
    isPending: harness.advancePending,
  }),
  useClientChainInstances: () => ({ data: [makeInstance()], isLoading: false }),
  useCancelChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useClientPinnedChainIds: () => ({ data: [] }),
  useRewindChainInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/features/taChains/hooks/useTAChains', () => ({
  useTAChains: () => ({ data: { items: harness.chains }, isLoading: harness.isLoadingChains }),
  useTAChain: () => ({ data: harness.chain }),
  usePinTAChain: () => ({ mutateAsync: vi.fn() }),
  useUnpinTAChain: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('@/features/targetActions/hooks/useTargetActions', () => ({
  useTargetActions: () => ({
    data: {
      items: [3, 4].map((id) => ({
        id,
        name: 'Результат',
        field_type: 'dropdown',
        is_hidden: false,
        dropdown_values: [{ id: 7, value: 'Домовленість', sort_order: 0, is_hidden: false }],
      })),
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
// Called both with and without a selector in this component, so the mock has
// to support each form rather than assuming one.
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: (s: unknown) => unknown) => {
    const state = { user: { active_project_id: '1', timezone: 'Europe/Kiev' } }
    return sel ? sel(state) : state
  },
}))
vi.mock('@/stores/chainExecutorStore', () => ({
  useChainExecutorStore: Object.assign(
    (sel?: (s: unknown) => unknown) => {
      const state = { minimized: null, setMinimized: vi.fn(), clear: vi.fn() }
      return sel ? sel(state) : state
    },
    { getState: () => ({ minimized: null }) }
  ),
}))
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    // The second argument is a default string in some calls and an
    // interpolation object in others; only the string form is a default.
    useTranslation: () => ({
      t: (k: string, d?: unknown) => (typeof d === 'string' ? d : k),
      i18n: { language: 'en' },
    }),
  }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/**
 * Held in a variable so a test can assert it is NOT consulted on ordinary
 * typing — reading layout is the expensive part of the Enter scoping check.
 */
export const getClientRects = vi.fn(() => [{ width: 100, height: 100 }] as unknown as DOMRectList)

/**
 * Exported so a test can assert HOW the panel is brought into view: the
 * opening-focus effect focuses Save with `preventScroll` and scrolls the panel
 * to its top, rather than letting focus drag the modal body to the bottom.
 */
export const scrollIntoView = vi.fn()

const originalPrototypeMethods = {
  scrollIntoView: Element.prototype.scrollIntoView,
  hasPointerCapture: Element.prototype.hasPointerCapture,
  releasePointerCapture: Element.prototype.releasePointerCapture,
  setPointerCapture: Element.prototype.setPointerCapture,
  getClientRects: Element.prototype.getClientRects,
}

/** Call from `beforeAll`. jsdom implements none of these. */
export function installDomStubs() {
  Element.prototype.scrollIntoView = scrollIntoView
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.setPointerCapture = vi.fn()
  // jsdom lays nothing out, so the panel would read as off screen.
  Element.prototype.getClientRects = getClientRects
}

/** Call from `afterAll`, so the stubs cannot leak if file isolation is off. */
export function restoreDomStubs() {
  Object.assign(Element.prototype, originalPrototypeMethods)
}
