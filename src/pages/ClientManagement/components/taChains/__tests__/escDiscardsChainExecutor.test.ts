/**
 * KAN-1112 — ESC on the Target Action modal must RESET and close, not minimize.
 *
 * The behaviour that matters is not "the modal went away" — both minimize and
 * abandon do that. It is what survives in `chainExecutorStore`, because a
 * surviving minimized session is what `decideHotkeyLaunch` refuses to launch
 * over. That refusal is the operator-visible bug in the ticket: wrong hotkey →
 * ESC → correct hotkey, and the second press does nothing.
 *
 * These test the two pure pieces the page wires together, so they hold without
 * mounting the whole ClientDetailPage.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { decideHotkeyAutoStart } from '@/features/taHotkeys/decideHotkeyAutoStart'
import { decideHotkeyLaunch } from '@/features/taHotkeys/decideHotkeyLaunch'
import { useChainExecutorStore, type MinimizedChainExecutorInfo } from '@/stores/chainExecutorStore'

// Typed, so drift in the store's shape fails HERE rather than at each call
// site. The empty strings are deliberate: formState's fields are non-nullable
// `string` — "nothing entered yet" is '' in this store, never null.
const session = (clientId = 1): MinimizedChainExecutorInfo => ({
  clientId,
  clientName: 'Test Client',
  responsibleEmployeeId: null,
  chainName: 'Chain A',
  currentStepOrder: 1,
  totalSteps: 3,
  timestamp: Date.now(),
  debts: [],
  formState: {
    stepValue: 'half typed',
    promiseDate: '',
    promiseAmount: '',
    creditId: '',
    notes: '',
    completedSteps: [],
    collectedStepData: {},
    collectedDropdownValueIds: {},
    collectedPromiseDate: '',
    collectedPromiseAmount: '',
    collectedCreditId: '',
    editedSteps: {},
  },
})

describe('a minimized session blocks the next hotkey', () => {
  beforeEach(() => {
    useChainExecutorStore.getState().clear()
    localStorage.clear()
  })

  it('refuses to launch while one exists — the bug ESC has to avoid', () => {
    const decision = decideHotkeyLaunch({
      template: { id: 7 },
      isExecutorOpen: false,
      hasMinimizedSession: true,
    })
    expect(decision.launch).toBeNull()
    expect(decision.blocked).toBe('minimized')
  })

  it('launches once nothing is left behind', () => {
    const decision = decideHotkeyLaunch({
      template: { id: 7 },
      isExecutorOpen: false,
      hasMinimizedSession: false,
    })
    expect(decision.launch).toEqual({ id: 7 })
    expect(decision.blocked).toBeNull()
  })
})

describe('what ESC and × must leave behind', () => {
  beforeEach(() => {
    useChainExecutorStore.getState().clear()
    localStorage.clear()
  })

  it('clear() empties the store, so the next hotkey is not blocked', () => {
    const store = useChainExecutorStore.getState()
    store.setMinimized(session())
    expect(useChainExecutorStore.getState().minimized).not.toBeNull()

    // This is what discardChainExecutor calls.
    useChainExecutorStore.getState().clear()

    const after = useChainExecutorStore.getState().minimized
    expect(after).toBeNull()
    expect(
      decideHotkeyLaunch({
        template: { id: 9 },
        isExecutorOpen: false,
        hasMinimizedSession: after !== null,
      }).launch
    ).toEqual({ id: 9 })
  })

  it('clear() also wipes the persisted copy, so a reload stays clean', () => {
    useChainExecutorStore.getState().setMinimized(session())
    useChainExecutorStore.getState().clear()
    const persisted = localStorage.getItem('minimized-chain-executor')
    expect(persisted === null || persisted === 'null').toBe(true)
  })

  it('minimizing still KEEPS the entered steps — ESC must not change that', () => {
    useChainExecutorStore.getState().setMinimized(session())
    const kept = useChainExecutorStore.getState().minimized
    expect(kept?.formState?.stepValue).toBe('half typed')
  })
})

describe('AC3 — ESC behaves the same at every fill-in state', () => {
  beforeEach(() => {
    useChainExecutorStore.getState().clear()
    localStorage.clear()
  })

  /** The three states the ticket names, as they would sit in the store. */
  type FormPatch = Partial<MinimizedChainExecutorInfo['formState']>
  const FILL_STATES: Array<[string, FormPatch]> = [
    ['freshly opened / empty', { stepValue: '', notes: '', completedSteps: [] }],
    ['partially filled', { stepValue: 'half typed', notes: 'a note', completedSteps: [] }],
    [
      'fully filled',
      {
        stepValue: 'done',
        notes: 'all of it',
        completedSteps: [{ stepOrder: 1, taName: 'TA', taValue: 'v' }],
      },
    ],
  ]

  it.each(FILL_STATES)('%s — nothing survives the discard', (_label, formState) => {
    const base = session()
    useChainExecutorStore.getState().setMinimized({
      ...base,
      formState: { ...base.formState, ...formState },
    })
    expect(useChainExecutorStore.getState().minimized).not.toBeNull()

    // What ESC and the × button both call.
    useChainExecutorStore.getState().clear()

    expect(useChainExecutorStore.getState().minimized).toBeNull()
    // ...and the next hotkey is therefore free to launch.
    expect(
      decideHotkeyLaunch({
        template: { id: 1 },
        isExecutorOpen: false,
        hasMinimizedSession: useChainExecutorStore.getState().minimized !== null,
      }).blocked
    ).toBeNull()
  })

  it('no confirmation step exists between the key and the reset', () => {
    // clear() is synchronous and unconditional — there is nowhere for a prompt
    // to live, which is what "instantly … no confirmation dialog" requires.
    useChainExecutorStore.getState().setMinimized(session())
    useChainExecutorStore.getState().clear()
    expect(useChainExecutorStore.getState().minimized).toBeNull()
  })
})

/**
 * The flow the ticket is actually about, in the reporter's own words:
 *
 *   hotkey 1  -> step 1 reads "Refuse to pay"
 *   ESC       -> all progress cleared
 *   hotkey 2  -> step 1 must read "Agreement"
 *
 * The reported failure was step 1 coming up EMPTY after ESC. Clearing the
 * local snapshot is not enough to prevent that: hotkey 1 has already created a
 * chain INSTANCE on the server, and decideHotkeyAutoStart declines to start a
 * template while one is active. So ESC must cancel the instance too.
 */
describe('AC4 — the wrong-hotkey recovery flow', () => {
  const TEMPLATES = [
    { id: 1, name: 'Refuse to pay' },
    { id: 2, name: 'Agreement' },
  ]

  it('a surviving instance makes the next hotkey open an EMPTY step', () => {
    // What the reporter saw: the launch is not blocked, the modal opens, but no
    // template is applied — so step 1 is blank.
    expect(
      decideHotkeyLaunch({
        template: TEMPLATES[1],
        isExecutorOpen: false,
        hasMinimizedSession: false,
      }).launch
    ).toEqual(TEMPLATES[1])

    const autoStart = decideHotkeyAutoStart({
      initialTemplateId: 2,
      instancesLoaded: true,
      hasActiveInstance: true, // hotkey 1's instance, never cancelled by ESC
      templates: TEMPLATES,
    })
    expect(autoStart.start).toBeNull()
  })

  it('once ESC cancels the instance, hotkey 2 applies its own template', () => {
    const autoStart = decideHotkeyAutoStart({
      initialTemplateId: 2,
      instancesLoaded: true,
      hasActiveInstance: false, // ESC cancelled it
      templates: TEMPLATES,
    })
    expect(autoStart.start).toEqual({ id: 2, name: 'Agreement' })
  })

  it('and it is the SECOND template that lands, not the first', () => {
    const { start } = decideHotkeyAutoStart({
      initialTemplateId: 2,
      instancesLoaded: true,
      hasActiveInstance: false,
      templates: TEMPLATES,
    })
    expect(start?.name).toBe('Agreement')
    expect(start?.name).not.toBe('Refuse to pay')
  })

  it('both halves are needed: cleared snapshot AND cancelled instance', () => {
    // Snapshot cleared but instance alive -> still empty. This is exactly the
    // gap the first attempt at this ticket left behind.
    useChainExecutorStore.getState().clear()
    expect(
      decideHotkeyAutoStart({
        initialTemplateId: 2,
        instancesLoaded: true,
        hasActiveInstance: true,
        templates: TEMPLATES,
      }).start
    ).toBeNull()
  })
})
