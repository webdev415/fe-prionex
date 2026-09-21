import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The configuration is read into module-level constants at IMPORT time, because
 * that is the only shape Vite substitutes at build time. That makes `vi.stubEnv`
 * alone useless here — the values are already frozen by the time a test runs —
 * so every case re-imports the module after stubbing, the same way
 * `features/operatorPhone/__tests__/prodOrigin.test.ts` does.
 */
async function loadConfig(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [name, value] of Object.entries(env)) {
    vi.stubEnv(name, value as string)
  }
  return await import('../config')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const KEY = 'VITE_OPENREPLAY_PROJECT_KEY'
const INGEST = 'VITE_OPENREPLAY_INGEST_URL'
const PRIVATE = 'VITE_OPENREPLAY_PRIVATE_MODE'

const INGEST_URL = 'https://openreplay.crm-prionex.online/ingest'

describe('OPENREPLAY_ENABLED', () => {
  it('is true only when both the key and the ingest URL are present', async () => {
    const config = await loadConfig({ [KEY]: 'wsn2ukJd7XlejKMeDAxM', [INGEST]: INGEST_URL })

    expect(config.OPENREPLAY_ENABLED).toBe(true)
    expect(config.OPENREPLAY_PROJECT_KEY).toBe('wsn2ukJd7XlejKMeDAxM')
    expect(config.OPENREPLAY_INGEST_URL).toBe(INGEST_URL)
  })

  // An environment that has not been switched on yet builds with an empty key.
  // That must read as "the tracker does not start", never as a broken build.
  it('is false when the key is missing', async () => {
    const config = await loadConfig({ [KEY]: undefined, [INGEST]: INGEST_URL })

    expect(config.OPENREPLAY_ENABLED).toBe(false)
  })

  it('is false when the ingest URL is missing', async () => {
    const config = await loadConfig({ [KEY]: 'wsn2ukJd7XlejKMeDAxM', [INGEST]: undefined })

    expect(config.OPENREPLAY_ENABLED).toBe(false)
  })

  // An unset build-arg reaches the bundle as an empty string, and a hand-edited
  // variable can carry a stray space. Both must count as "not configured"
  // rather than as a key made of whitespace.
  it('treats blank and whitespace-only values as unset', async () => {
    const config = await loadConfig({ [KEY]: '   ', [INGEST]: INGEST_URL })

    expect(config.OPENREPLAY_ENABLED).toBe(false)
    expect(config.OPENREPLAY_PROJECT_KEY).toBe('')
  })

  it('trims surrounding whitespace off usable values', async () => {
    const config = await loadConfig({
      [KEY]: '  wsn2ukJd7XlejKMeDAxM  ',
      [INGEST]: `  ${INGEST_URL}  `,
    })

    expect(config.OPENREPLAY_ENABLED).toBe(true)
    expect(config.OPENREPLAY_PROJECT_KEY).toBe('wsn2ukJd7XlejKMeDAxM')
    expect(config.OPENREPLAY_INGEST_URL).toBe(INGEST_URL)
  })
})

describe('OPENREPLAY_PRIVATE_MODE', () => {
  it('is off when the variable is unset', async () => {
    const config = await loadConfig({ [PRIVATE]: undefined })

    expect(config.OPENREPLAY_PRIVATE_MODE).toBe(false)
  })

  it.each(['true', '1'])('is on for the literal %j', async (value) => {
    const config = await loadConfig({ [PRIVATE]: value })

    expect(config.OPENREPLAY_PRIVATE_MODE).toBe(true)
  })

  // The value is compared as a string, so anything else is off. Asserted rather
  // than left implicit: `True` reading as "on" is exactly the silent mistake
  // someone makes when typing the variable into the repository settings.
  it.each(['True', 'TRUE', 'yes', 'on', 'false', '0', ''])('is off for %j', async (value) => {
    const config = await loadConfig({ [PRIVATE]: value })

    expect(config.OPENREPLAY_PRIVATE_MODE).toBe(false)
  })
})
