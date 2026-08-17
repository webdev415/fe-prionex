import { afterEach, describe, expect, it, vi } from 'vitest'

// Regression guard for the defect fixed on 2026-08-17: `VITE_OPERATOR_PHONE_URL`
// was outside Dockerfile.prod's build-arg contract, so every CI image had it
// undefined and `constants.ts` fell back to `http://localhost:5173` — the origin
// this app postMessages its JWT to.
//
// 🔴 Grepping the built bundle for that string does NOT prove the fix: the
// literal survives as `deriveOrigin`'s catch-branch fallback whether or not it is
// ever used. What matters is the resolved value, which is what this file asserts.
async function loadConstants() {
  vi.resetModules()
  return await import('../constants')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('operator phone origin', () => {
  it('resolves to nothing in a production build when unconfigured', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_OPERATOR_PHONE_URL', '')
    const c = await loadConstants()
    expect(c.OPERATOR_PHONE_URL).toBeNull()
    expect(c.OPERATOR_PHONE_ENABLED).toBe(false)
    // The assertion that matters: nothing can be posted to localhost.
    expect(c.OPERATOR_PHONE_ORIGIN).toBe('')
    expect(c.OPERATOR_PHONE_ORIGIN).not.toContain('localhost')
  })

  it('uses the configured URL in a production build', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_OPERATOR_PHONE_URL', 'https://phone.crm-prionex.online')
    const c = await loadConstants()
    expect(c.OPERATOR_PHONE_ENABLED).toBe(true)
    expect(c.OPERATOR_PHONE_ORIGIN).toBe('https://phone.crm-prionex.online')
  })

  it('keeps the localhost convenience for local development', async () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_OPERATOR_PHONE_URL', '')
    const c = await loadConstants()
    expect(c.OPERATOR_PHONE_ENABLED).toBe(true)
    expect(c.OPERATOR_PHONE_ORIGIN).toBe('http://localhost:5173')
  })
})
