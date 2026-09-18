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

async function load() {
  const setUserID = vi.fn()
  const setMetadata = vi.fn()
  const start = vi.fn(async () => ({ success: true }) as const)
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
  return { useAuthStore, index, identify, setUserID, setMetadata, start, stop, construct }
}

/** Let every queued microtask and the tracker promise chain settle. */
const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
  await new Promise((r) => setTimeout(r, 0))
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
    const { useAuthStore, index, identify, setUserID, setMetadata } = await load()
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
    const { useAuthStore, index, identify, setUserID, setMetadata } = await load()
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
    // Page load on the login screen: nobody yet, and that is not a logout.
    const { useAuthStore, index, identify, stop } = await load()
    useAuthStore.setState({ user: null, isAuthenticated: false })

    index.startOpenReplay()
    const unbind = identify.bindOperatorIdentity()
    await settle()

    expect(stop).not.toHaveBeenCalled()
    unbind()
  })

  it('stops the session on logout and starts a new one on the next login', async () => {
    // ⚠️ One session per tab, and no way to unset a user id: without the stop a
    // second login would rewrite the whole session's owner. Shared workstations
    // make this the normal case, not the edge.
    const { useAuthStore, index, identify, setUserID, start, stop } = await load()
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

  it('restarts the SAME instance rather than constructing a second tracker', async () => {
    // A second `new Tracker()` would register a second set of DOM observers on
    // the same document — the thing the single-start guard exists to prevent.
    const { useAuthStore, index, identify, construct } = await load()
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
    const { useAuthStore, index, identify, setUserID, setMetadata } = await load()
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
