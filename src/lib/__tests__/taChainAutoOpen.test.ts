import { describe, it, expect } from 'vitest'
import { decideChainAutoOpen, type ChainInstanceLite } from '../taChainAutoOpen'

const launchedChain: ChainInstanceLite = { id: 100, status: 'active', started_by: null }
const noSeen = new Set<number>()

describe('decideChainAutoOpen — single decision', () => {
  it('does nothing when not armed', () => {
    expect(
      decideChainAutoOpen({
        armed: false,
        instances: [launchedChain],
        seenIds: noSeen,
        isExecutorOpen: false,
      })
    ).toEqual({ open: false, disarm: false })
  })

  it('does nothing while instances are still loading (undefined)', () => {
    expect(
      decideChainAutoOpen({
        armed: true,
        instances: undefined,
        seenIds: noSeen,
        isExecutorOpen: false,
      })
    ).toEqual({ open: false, disarm: false })
  })

  it('OPENS (and stays armed) when the launched chain appears and the modal is closed', () => {
    expect(
      decideChainAutoOpen({
        armed: true,
        instances: [launchedChain],
        seenIds: noSeen,
        isExecutorOpen: false,
      })
    ).toEqual({ open: true, disarm: false })
  })

  it('DISARMS (does not re-open) once the modal is already showing', () => {
    expect(
      decideChainAutoOpen({
        armed: true,
        instances: [launchedChain],
        seenIds: noSeen,
        isExecutorOpen: true,
      })
    ).toEqual({ open: false, disarm: true })
  })

  it('ignores a chain that existed before the status change (snapshot guard)', () => {
    expect(
      decideChainAutoOpen({
        armed: true,
        instances: [launchedChain],
        seenIds: new Set([launchedChain.id]),
        isExecutorOpen: false,
      })
    ).toEqual({ open: false, disarm: false })
  })

  it('ignores a chain started by hand (started_by set, not system-launched)', () => {
    expect(
      decideChainAutoOpen({
        armed: true,
        instances: [{ id: 5, status: 'active', started_by: 42 }],
        seenIds: noSeen,
        isExecutorOpen: false,
      })
    ).toEqual({ open: false, disarm: false })
  })

  it('ignores a non-active (e.g. completed) chain', () => {
    expect(
      decideChainAutoOpen({
        armed: true,
        instances: [{ id: 6, status: 'completed', started_by: null }],
        seenIds: noSeen,
        isExecutorOpen: false,
      })
    ).toEqual({ open: false, disarm: false })
  })
})

/**
 * Drive the decision the way the React effect does, tick by tick, so we can
 * assert the end-to-end "after a status change the modal shows" behaviour —
 * including the operator clicking around during the wait.
 *
 * `openSticksAt(tick)` models whether an `open` actually takes effect on that
 * tick. Returning false simulates a perturbation (e.g. a click elsewhere on the
 * page) that prevents the modal from opening on that tick.
 */
function runWaitWindow(opts: {
  instancesByTick: Array<ChainInstanceLite[]>
  seenIds: Set<number>
  openSticksAt: (tick: number) => boolean
  maxTicks?: number
}): { opened: boolean; armedAtEnd: boolean; openedAtTick: number | null } {
  let armed = true
  let isExecutorOpen = false
  let opened = false
  let openedAtTick: number | null = null
  const maxTicks = opts.maxTicks ?? 12

  for (let t = 0; t < maxTicks; t++) {
    const instances = opts.instancesByTick[Math.min(t, opts.instancesByTick.length - 1)]
    const { open, disarm } = decideChainAutoOpen({
      armed,
      instances,
      seenIds: opts.seenIds,
      isExecutorOpen,
    })
    if (open) {
      if (opts.openSticksAt(t)) {
        isExecutorOpen = true
        if (!opened) openedAtTick = t
        opened = true
      }
    } else if (disarm) {
      armed = false
    }
    if (!armed) break
  }
  return { opened, armedAtEnd: armed, openedAtTick }
}

describe('decideChainAutoOpen — wait-window simulation', () => {
  it('chain arrives after a couple of empty polls, then the modal opens', () => {
    const result = runWaitWindow({
      // ticks 0-1: chain not created yet; tick 2+: it exists.
      instancesByTick: [[], [], [launchedChain]],
      seenIds: noSeen,
      openSticksAt: () => true,
    })
    expect(result.opened).toBe(true)
    expect(result.openedAtTick).toBe(2)
    expect(result.armedAtEnd).toBe(false) // disarmed after it showed
  })

  it('STILL opens when a click blocks the first open attempts (retry-until-shown)', () => {
    const result = runWaitWindow({
      instancesByTick: [[launchedChain]],
      seenIds: noSeen,
      // The operator clicks around: the open does not take on ticks 0-2.
      openSticksAt: (t) => t >= 3,
    })
    // The OLD "fire once" logic would have given up at tick 0 and never shown.
    expect(result.opened).toBe(true)
    expect(result.openedAtTick).toBe(3)
    expect(result.armedAtEnd).toBe(false)
  })

  it('never pops for a passive viewer (not armed → loop is a no-op)', () => {
    // Not armed at all: simulate by short-circuiting like the effect does.
    const decision = decideChainAutoOpen({
      armed: false,
      instances: [launchedChain],
      seenIds: noSeen,
      isExecutorOpen: false,
    })
    expect(decision).toEqual({ open: false, disarm: false })
  })

  it('does not re-pop after the operator closes the modal', () => {
    // Open once (tick 0), then the operator closes it (isExecutorOpen back to
    // false) — but we already disarmed, so the effect won't fire again.
    let armed = true
    let isExecutorOpen = false

    // tick 0: open
    let d = decideChainAutoOpen({
      armed,
      instances: [launchedChain],
      seenIds: noSeen,
      isExecutorOpen,
    })
    expect(d).toEqual({ open: true, disarm: false })
    isExecutorOpen = true

    // tick 1: already open → disarm
    d = decideChainAutoOpen({ armed, instances: [launchedChain], seenIds: noSeen, isExecutorOpen })
    expect(d).toEqual({ open: false, disarm: true })
    armed = false

    // operator closes the modal
    isExecutorOpen = false

    // tick 2: disarmed → no re-pop
    d = decideChainAutoOpen({ armed, instances: [launchedChain], seenIds: noSeen, isExecutorOpen })
    expect(d).toEqual({ open: false, disarm: false })
  })
})

describe('decideChainAutoOpen - System (hidden) chains (KAN-1045)', () => {
  // A hidden chain's instance fits the "launched" description exactly: active,
  // and system-started because a trigger created it. Visibility is the only
  // thing that tells it apart.
  const hiddenChain: ChainInstanceLite = {
    id: 200,
    status: 'active',
    started_by: null,
    is_system_hidden: true,
  }

  it('does not pop the executor for one', () => {
    const decision = decideChainAutoOpen({
      armed: true,
      instances: [hiddenChain],
      seenIds: noSeen,
      isExecutorOpen: false,
    })
    expect(decision).toEqual({ open: false, disarm: false })
  })

  it('stays armed while only hidden instances exist, so a later real one pops', () => {
    // This is where the real damage shows. The search stops at the first match
    // and disarms, so an unguarded hidden instance would consume the pop the
    // operator's own debt-status chain was owed. A pure open/disarm result
    // cannot say WHICH instance opened it — staying armed is the observable
    // proof that the hidden one was passed over rather than acted on.
    let d = decideChainAutoOpen({
      armed: true,
      instances: [hiddenChain],
      seenIds: noSeen,
      isExecutorOpen: false,
    })
    expect(d).toEqual({ open: false, disarm: false })

    // The operator's chain shows up on a later poll.
    d = decideChainAutoOpen({
      armed: true,
      instances: [hiddenChain, launchedChain],
      seenIds: noSeen,
      isExecutorOpen: false,
    })
    expect(d).toEqual({ open: true, disarm: false })
  })

  it('still pops an ordinary system-started chain (the KAN-396 flow)', () => {
    // The guard must not catch debt-status chains, which are also
    // system-started - they are simply not hidden.
    const decision = decideChainAutoOpen({
      armed: true,
      instances: [{ ...launchedChain, is_system_hidden: false }],
      seenIds: noSeen,
      isExecutorOpen: false,
    })
    expect(decision).toEqual({ open: true, disarm: false })
  })
})
