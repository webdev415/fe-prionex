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
