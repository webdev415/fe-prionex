import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { User } from '@/types/api'

/**
 * Operator identity on the session. The decision under test is WHO a session is
 * attributed to, and what is deliberately NOT sent — so the assertions are as
 * much about absent calls as present ones.
 *
 * The module is re-imported per case for the same reason `start.test.ts` does
 * it: `config.ts` reads `import.meta.env` into constants at import time.
 */

const KEY = 'VITE_OPENREPLAY_PROJECT_KEY'
const INGEST = 'VITE_OPENREPLAY_INGEST_URL'

const user = (over: Partial<User> = {}): User => ({
  id: '1042',
  username: 'o.kovalenko',
  email: 'o.kovalenko@example.test',
  firstName: 'Олег',
  lastName: 'Коваленко',
  fullName: 'Олег Коваленко',
  projects: [],
  active_project_id: '7',
  active_role_id: '3',
  active_role_name: 'operator',
  active_department_id: 12,
  ...over,
})

/** Every string that would identify the operator as a PERSON rather than a row. */
const PERSONAL = ['o.kovalenko', 'o.kovalenko@example.test', 'Олег', 'Коваленко']

async function load(opts: { deferFirstStart?: boolean } = {}) {
  const setUserID = vi.fn()
  const setMetadata = vi.fn()
  // `release` resolves a deliberately pending FIRST start — the window a
  // logout+login can land in while the tracker chunk is still downloading.
  let release: () => void = () => {}
  let starts = 0
  const start = vi.fn(async (_opts?: unknown) => {
    starts += 1
    if (opts.deferFirstStart && starts === 1) {
      await new Promise<void>((r) => (release = r))
    }
    return { success: true } as const
  })
  const stop = vi.fn()
  const construct = vi.fn()

  vi.resetModules()
  vi.stubEnv(KEY, 'test-project-key')
  vi.stubEnv(INGEST, 'https://openreplay.crm-prionex.online/ingest')
  vi.doMock('@openreplay/tracker', () => ({
    default: class {
      constructor(opts: unknown) {
        construct(opts)
      }
      start = start
      stop = stop
      setUserID = setUserID
      setMetadata = setMetadata
    },
  }))

  const { useAuthStore } = await import('@/stores/authStore')
  const index = await import('../index')
  const identify = await import('../identify')
  // Every case starts from a fresh tab: no recorded owner. The cases that model
  // a reload of a tab that already ran somebody's session record one first.
  window.sessionStorage.clear()
  return {
    /** This tab already ran `actorId`'s session before the page loaded. */
    tabOwnedBy: (actorId: string) => {
      window.sessionStorage.setItem(identify.OWNER_KEY, actorId)
      window.sessionStorage.setItem('__openreplay_token', 'replay-token-of-' + actorId)
    },
    /** A replay session was continuing at boot, but no owner is recorded (logout of any kind). */
    tabContinuingUnowned: () =>
      window.sessionStorage.setItem('__openreplay_token', 'replay-token-of-somebody'),
    setAccessToken: (await import('@/lib/api')).setAccessToken,
    useAuthStore,
    index,
    identify,
    setUserID,
    setMetadata,
    start,
    stop,
    construct,
    release: () => release(),
  }
}

/**
 * Let every queued microtask and the tracker promise chain settle.
 *
 * Several macrotask turns, not one: a chain that hops through `await getTracker()`
 * → `stopping` → `construction` → `start()` schedules continuations across
 * turns, and a single `setTimeout(0)` can return with the tail still pending.
 */
const settle = async () => {
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < 8; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
  }
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.doUnmock('@openreplay/tracker')
  vi.restoreAllMocks()
})

describe('identityFrom — who the session belongs to', () => {
  it('names the signed-in user by id', async () => {
    const { identify } = await load()
    const id = identify.identityFrom({
      user: user(),
      isImpersonating: false,
      originalAdminUser: null,
      impersonatedUser: null,
    })
    expect(id?.actorId).toBe('1042')
    expect(id?.impersonating).toBe('')
  })

  it('names the ADMIN while impersonating, and the target only in metadata', async () => {
    // 🔴 `user` carries the target's role and permissions during impersonation —
    // that is what the permission gates read — but the person at the keyboard is
    // the admin. Attribution is about accountability, so the admin it is.
    const { identify } = await load()
    const id = identify.identityFrom({
      user: user({ id: '2001', username: 'target' }),
      isImpersonating: true,
      originalAdminUser: user({ id: '1', username: 'admin' }),
      impersonatedUser: user({ id: '2001', username: 'target' }),
    })
    expect(id?.actorId).toBe('1')
    expect(id?.impersonating).toBe('2001')
  })

  it('is null when nobody is signed in', async () => {
    const { identify } = await load()
    expect(
      identify.identityFrom({
        user: null,
        isImpersonating: false,
        originalAdminUser: null,
        impersonatedUser: null,
      })
    ).toBeNull()
  })

  it('carries nothing that names a person', async () => {
    const { identify } = await load()
    const id = identify.identityFrom({
      user: user(),
      isImpersonating: false,
      originalAdminUser: null,
      impersonatedUser: null,
    })!
    for (const value of Object.values(id)) {
      for (const personal of PERSONAL) expect(value).not.toContain(personal)
    }
  })
})

describe('bindOperatorIdentity — the running session', () => {
  it('sets the id and metadata once the tracker has started', async () => {
    const { useAuthStore, index, identify, setUserID, setMetadata, tabOwnedBy } = await load()
    tabOwnedBy('1042') // signed in at boot: this tab already ran their session
    useAuthStore.setState({ user: user(), isAuthenticated: true })

    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()

    expect(setUserID).toHaveBeenCalledWith('1042')
    expect(setMetadata).toHaveBeenCalledWith('role', 'operator')
    expect(setMetadata).toHaveBeenCalledWith('project', '7')
    expect(setMetadata).toHaveBeenCalledWith('department', '12')
    expect(setMetadata).toHaveBeenCalledWith('impersonating', '')
    unbind()
  })

  it('never sends the username, e-mail or name — the id is the pseudonym', async () => {
    // The point of KAN-KB-54 applied to the session header itself.
    const { useAuthStore, index, identify, setUserID, setMetadata, tabOwnedBy } = await load()
    tabOwnedBy('1042') // signed in at boot: this tab already ran their session
    useAuthStore.setState({ user: user(), isAuthenticated: true })

    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()

    const sent = [...setUserID.mock.calls, ...setMetadata.mock.calls].flat().map(String)
    for (const personal of PERSONAL) {
      expect(
        sent.some((v) => v.includes(personal)),
        `sent ${personal}`
      ).toBe(false)
    }
    unbind()
  })

  it('does not stop a tracker that started with nobody signed in', async () => {
    // Page load on the login screen: nobody yet, and that is not a logout. The
    // login screen keeps being recorded until somebody signs in.
    const { useAuthStore, index, identify, stop } = await load()
    useAuthStore.setState({ user: null, isAuthenticated: false })

    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()

    expect(stop).not.toHaveBeenCalled()
    unbind()
  })

  it('opens a NEW session when somebody signs in on a login screen left by a logout', async () => {
    // A login screen reached by a hard redirect (401 interceptor, cross-tab
    // logout — both leave via `window.location.href`, so no in-page logout is
    // ever observed). The owner key was never cleared… or it was, by an
    // in-page logout in an earlier page — either way the tracker's own token
    // is still in sessionStorage and the page-load start is CONTINUING the
    // previous operator's session. Whoever signs in must not inherit it.
    const { useAuthStore, index, identify, start, stop, tabContinuingUnowned } = await load()
    tabContinuingUnowned()
    // Real boot order: the store is empty at bind, whatever happens later.
    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()
    expect(start).toHaveBeenCalledTimes(1)

    useAuthStore.setState({
      user: user({ id: '2077' }),
      isAuthenticated: true,
      hasCheckedAuth: true,
    })
    await settle()

    expect(stop).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledTimes(2)
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[1])
    expect(start.mock.calls[1][0]).toMatchObject({ forceNew: true, userID: '2077' })
    expect(window.sessionStorage.getItem(identify.OWNER_KEY)).toBe('2077')
    unbind()
  })

  it('adopts the page-load session in a FRESH tab instead of restarting it', async () => {
    // No owner and no replay token at boot: the session the page load opened is
    // nobody's yet, and nothing predates the operator who signs in. Restarting
    // here produced one anonymous two-second stub session per new tab (Fable
    // review); adopting it via setUserID attributes the whole tab correctly.
    const { useAuthStore, index, identify, start, stop, setUserID } = await load()
    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()

    useAuthStore.setState({
      user: user({ id: '2077' }),
      isAuthenticated: true,
      hasCheckedAuth: true,
    })
    await settle()

    expect(stop).not.toHaveBeenCalled()
    expect(start).toHaveBeenCalledTimes(1)
    expect(setUserID).toHaveBeenLastCalledWith('2077')
    expect(window.sessionStorage.getItem(identify.OWNER_KEY)).toBe('2077')
    unbind()
  })

  it('continues the session across a reload by the operator who owns it', async () => {
    // 🔴 The case that must NOT restart, modelled in the order the app really
    // boots: the store is EMPTY when `main.tsx` binds the identity, and
    // `checkAuth()` fills it two network round-trips later. A rule keyed on
    // "nobody in the store at bind" saw exactly this as a new owner and
    // restarted the session on every F5 (Fable review). The owner this tab
    // recorded before the reload is what tells a reload from a login screen.
    const { useAuthStore, index, identify, start, stop, tabOwnedBy, setAccessToken } = await load()
    // The CRM token (localStorage, shared by every tab) says who is signed in NOW.
    // It is deliberately present in both this test and the next: the owner key,
    // not the token, is what has to tell the two cases apart.
    setAccessToken('jwt-of-' + '1042')
    tabOwnedBy('1042')
    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()

    // checkAuth resolves the CRM token to its owner.
    useAuthStore.setState({
      user: user({ id: '1042' }),
      isAuthenticated: true,
      hasCheckedAuth: true,
    })
    await settle()

    expect(stop).not.toHaveBeenCalled()
    expect(start).toHaveBeenCalledTimes(1)
    expect(start.mock.calls[0][0]).toMatchObject({ forceNew: undefined })
    unbind()
  })

  it("restarts when a DIFFERENT operator reloads a tab that ran somebody else's session", async () => {
    // 🔴 The multi-tab case (Fable review). X had this tab open; X signed out in
    // another tab, so this one hard-redirected to /login with X's replay
    // session still continuable; Y signed in elsewhere and now reloads this
    // tab. The CRM token (localStorage, shared) says Y; the replay session
    // (sessionStorage, per tab) is X's. A token-based rule renamed X's screens
    // to Y. The recorded owner is what this tab remembers on its own.
    const { useAuthStore, index, identify, start, stop, tabOwnedBy, setAccessToken } = await load()
    // The CRM token (localStorage, shared by every tab) says who is signed in NOW.
    // It is deliberately present in both this test and the next: the owner key,
    // not the token, is what has to tell the two cases apart.
    setAccessToken('jwt-of-' + '2077')
    tabOwnedBy('1042')
    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()

    useAuthStore.setState({
      user: user({ id: '2077' }),
      isAuthenticated: true,
      hasCheckedAuth: true,
    })
    await settle()

    expect(stop).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledTimes(2)
    expect(start.mock.calls[1][0]).toMatchObject({ forceNew: true, userID: '2077' })
    expect(window.sessionStorage.getItem(identify.OWNER_KEY)).toBe('2077')
    unbind()
  })

  it('forgets the owner on logout', async () => {
    const { useAuthStore, index, identify, tabOwnedBy } = await load()
    tabOwnedBy('1042')
    useAuthStore.setState({ user: user({ id: '1042' }), isAuthenticated: true })
    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()
    expect(window.sessionStorage.getItem(identify.OWNER_KEY)).toBe('1042')

    useAuthStore.setState({ user: null, isAuthenticated: false })
    await settle()
    expect(window.sessionStorage.getItem(identify.OWNER_KEY)).toBeNull()
    unbind()
  })

  it('stops the session on logout and starts a new one on the next login', async () => {
    // ⚠️ One session per tab, and no way to unset a user id: without the stop a
    // second login would rewrite the whole session's owner. Shared workstations
    // make this the normal case, not the edge.
    const { useAuthStore, index, identify, setUserID, start, stop, tabOwnedBy } = await load()
    // Signed in at boot: this tab ran 1042's session before the reload.
    tabOwnedBy('1042')
    useAuthStore.setState({ user: user({ id: '1042' }), isAuthenticated: true })

    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()
    expect(start).toHaveBeenCalledTimes(1)
    expect(setUserID).toHaveBeenLastCalledWith('1042')

    useAuthStore.setState({ user: null, isAuthenticated: false })
    await settle()
    expect(stop).toHaveBeenCalledTimes(1)
    await expect(index.getTracker()).resolves.toBeNull()

    useAuthStore.setState({ user: user({ id: '2077' }), isAuthenticated: true })
    await settle()
    expect(start).toHaveBeenCalledTimes(2)
    expect(setUserID).toHaveBeenLastCalledWith('2077')
    unbind()
  })

  it('opens a NEW session on the login after a logout — forceNew, identity atomically', async () => {
    // 🔴 Verified in @openreplay/tracker@18.0.6: `stop()` leaves the session
    // token in sessionStorage and a bare `start()` continues the old session.
    // Without `forceNew` the two logins would share one session with the id
    // rewritten to the second operator — the exact mis-attribution this module
    // exists to prevent. Counting start/stop calls, as the earlier test did,
    // could not see this.
    const { useAuthStore, index, identify, start, tabOwnedBy } = await load()
    // Signed in at boot: this tab ran 1042's session before the reload.
    tabOwnedBy('1042')
    useAuthStore.setState({ user: user({ id: '1042' }), isAuthenticated: true })
    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()
    // Page-load start: continue whatever session this tab already has.
    expect(start.mock.calls[0][0]).toMatchObject({ forceNew: undefined })

    useAuthStore.setState({ user: null, isAuthenticated: false })
    await settle()
    useAuthStore.setState({ user: user({ id: '2077' }), isAuthenticated: true })
    await settle()

    expect(start).toHaveBeenCalledTimes(2)
    expect(start.mock.calls[1][0]).toMatchObject({
      forceNew: true,
      userID: '2077',
      metadata: { role: 'operator', project: '7', department: '12', impersonating: '' },
    })
    unbind()
  })

  it('keeps a logout+login apart when both land while the first start is still pending', async () => {
    // What this pins is the SNAPSHOT: the queue carries the store state from
    // event time. Reading the store when the queued step finally ran collapsed
    // logout+login into "re-identify the same session" — by then the store held
    // the second user, no logout was ever seen, no stop issued. Fails on that
    // revert (stop: 0 calls).
    //
    // What it does NOT pin is the stop/start ordering inside index.ts: here the
    // identity queue itself holds the second login behind the first start, so
    // `stopOpenReplay()` is not even called until `release()`. The ordering
    // guarantee of `stopping` has its own test in start.test.ts, where stop and
    // start are called directly into the race window.
    const { useAuthStore, index, identify, start, stop, construct, release, tabOwnedBy } =
      await load({
        deferFirstStart: true,
      })
    // Signed in at boot: this tab ran 1042's session before the reload.
    tabOwnedBy('1042')
    useAuthStore.setState({ user: user({ id: '1042' }), isAuthenticated: true })
    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()
    expect(start).toHaveBeenCalledTimes(1) // pending

    useAuthStore.setState({ user: null, isAuthenticated: false })
    await settle()
    useAuthStore.setState({ user: user({ id: '2077' }), isAuthenticated: true })
    await settle()
    // Nothing may have happened yet: the stop waits on the first start, the
    // second start waits on the stop.
    expect(stop).not.toHaveBeenCalled()
    expect(start).toHaveBeenCalledTimes(1)

    release()
    await settle()
    expect(stop).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledTimes(2)
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[1])
    expect(construct).toHaveBeenCalledTimes(1)
    unbind()
  })

  it('restarts the SAME instance rather than constructing a second tracker', async () => {
    // A second `new Tracker()` would register a second set of DOM observers on
    // the same document — the thing the single-start guard exists to prevent.
    const { useAuthStore, index, identify, construct, tabOwnedBy } = await load()
    tabOwnedBy('1042') // signed in at boot: this tab already ran their session
    useAuthStore.setState({ user: user(), isAuthenticated: true })

    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()
    useAuthStore.setState({ user: null, isAuthenticated: false })
    await settle()
    useAuthStore.setState({ user: user({ id: '2' }), isAuthenticated: true })
    await settle()

    expect(construct).toHaveBeenCalledTimes(1)
    unbind()
  })

  it('re-identifies when impersonation begins, as the admin', async () => {
    const { useAuthStore, index, identify, setUserID, setMetadata, tabOwnedBy } = await load()
    tabOwnedBy('1') // signed in at boot: this tab already ran their session
    const admin = user({ id: '1', username: 'admin', active_role_name: 'admin' })
    useAuthStore.setState({ user: admin, isAuthenticated: true })

    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()

    const target = user({ id: '2001', username: 'target', active_role_name: 'operator' })
    useAuthStore.setState({
      user: target,
      isImpersonating: true,
      originalAdminUser: admin,
      impersonatedUser: target,
    })
    await settle()

    expect(setUserID).toHaveBeenLastCalledWith('1')
    expect(setMetadata).toHaveBeenCalledWith('impersonating', '2001')
    unbind()
  })
})
