import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The start path, which is the part of this feature that actually ships
 * behaviour: the early return that keeps the tracker chunk from ever being
 * requested, the single-start guard, the two shapes a failed start takes, and
 * the URL sanitizer handed to the tracker.
 *
 * Every case re-imports the module because `config.ts` reads `import.meta.env`
 * into constants at import time — the same reason
 * `features/operatorPhone/__tests__/prodOrigin.test.ts` works this way.
 */

const KEY = 'VITE_OPENREPLAY_PROJECT_KEY'
const INGEST = 'VITE_OPENREPLAY_INGEST_URL'
const INGEST_URL = 'https://openreplay.crm-prionex.online/ingest'

type StartResult = { success: true } | { success: false; reason: string }

/**
 * Load the module with '@openreplay/tracker' replaced. Returns the spies that
 * say whether the package was reached at all and with which options.
 */
async function loadWithMockedTracker(options: {
  enabled: boolean
  start?: () => Promise<StartResult>
  failImport?: boolean
}) {
  const construct = vi.fn()
  const start = vi.fn<(opts?: unknown) => Promise<StartResult>>(
    options.start ?? (async () => ({ success: true }) as StartResult)
  )
  const stop = vi.fn()
  // Called only if something actually imports the package — that is the
  // assertion behind "a build without a key downloads no tracker".
  const factory = vi.fn(() => {
    if (options.failImport) throw new Error('chunk load failed')
    return {
      default: class {
        constructor(opts: unknown) {
          construct(opts)
        }
        start = start
        stop = stop
      },
    }
  })

  vi.resetModules()
  vi.stubEnv(KEY, options.enabled ? 'test-project-key' : '')
  vi.stubEnv(INGEST, options.enabled ? INGEST_URL : '')
  vi.doMock('@openreplay/tracker', factory)

  const mod = await import('../index')
  return { mod, factory, construct, start, stop }
}

type SanitizedRecord = {
  url: string
  request?: { headers?: Record<string, string> }
  response?: { headers?: Record<string, string> }
}

/** The sanitizer the module handed to the tracker constructor. */
function sanitizerOf(construct: ReturnType<typeof vi.fn>) {
  const options = construct.mock.calls[0][0] as {
    network: { sanitizer: (d: SanitizedRecord) => SanitizedRecord }
  }
  return options.network.sanitizer
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.doUnmock('@openreplay/tracker')
  vi.restoreAllMocks()
})

describe('startOpenReplay', () => {
  it('does not reach the package at all when the key is absent', async () => {
    const { mod, factory, construct } = await loadWithMockedTracker({ enabled: false })

    mod.startOpenReplay()
    await expect(mod.getTracker()).resolves.toBeNull()

    // The chunk is never requested, so a disabled environment pays nothing.
    expect(factory).not.toHaveBeenCalled()
    expect(construct).not.toHaveBeenCalled()
  })

  it('constructs exactly one tracker however many times it is called', async () => {
    const { mod, construct, start } = await loadWithMockedTracker({ enabled: true })

    // StrictMode double-invocation, reproduced: the second call must be a no-op.
    mod.startOpenReplay()
    mod.startOpenReplay()
    mod.startOpenReplay()
    await mod.getTracker()

    expect(construct).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledTimes(1)
  })

  it('serialises stop and start called straight into the window of a pending start', async () => {
    // 🔴 The race from code review (round 3), reproduced at the level it lives
    // on: stop and start called directly while the FIRST start has not resolved
    // — the chunk is still downloading. Reasoned by microtask order, the new
    // `start()` ran first and the queued `stop()` second, on the same instance,
    // leaving a dead recording for the life of the tab; or, with the import not
    // yet resolved, a SECOND `new Tracker()` was built. Both must be
    // impossible whatever the timing: the next start chains behind `stopping`,
    // and the construction is one shared promise.
    //
    // This fails when the `stopping` chain is removed from index.ts (verified:
    // the second start() then precedes stop()). The identity-level test in
    // identify.test.ts cannot see this — its own queue orders the calls.
    let release: (r: StartResult) => void = () => {}
    let calls = 0
    const { mod, construct, start, stop } = await loadWithMockedTracker({
      enabled: true,
      start: () => {
        calls += 1
        if (calls === 1) return new Promise<StartResult>((r) => (release = r))
        return Promise.resolve({ success: true } as StartResult)
      },
    })

    mod.startOpenReplay()
    await Promise.resolve()
    // Straight into the window: the first start is pending.
    mod.stopOpenReplay()
    mod.startOpenReplay({ forceNew: true, userID: '2077' })
    await new Promise((r) => setTimeout(r, 0))

    expect(stop).not.toHaveBeenCalled()
    expect(start).toHaveBeenCalledTimes(1)

    release({ success: true })
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0))

    expect(stop).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledTimes(2)
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[1])
    expect(start.mock.calls[1][0]).toMatchObject({ forceNew: true, userID: '2077' })
    expect(construct).toHaveBeenCalledTimes(1)
    await expect(mod.getTracker()).resolves.not.toBeNull()
  })

  it('lets a later start retry after a construction that rejected', async () => {
    // Scenario (e) from the Fable pass: the dynamic import fails once. The next
    // start must not be silenced by a `trackerPromise` that resolved to null.
    const { mod, factory } = await loadWithMockedTracker({ enabled: true, failImport: true })
    mod.startOpenReplay()
    await expect(mod.getTracker()).resolves.toBeNull()
    expect(factory).toHaveBeenCalledTimes(1)

    mod.startOpenReplay()
    await mod.getTracker()
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('keeps the constructed instance when start() itself throws', async () => {
    // Review round 5. A rejection of the chain used to drop `construction`
    // whatever its cause — but a `start()` that THROWS after a good
    // construction is not a construction failure, and rebuilding would put a
    // second set of DOM observers on the same document. The instance is kept
    // and `start()` retried on it.
    let calls = 0
    const { mod, construct, start } = await loadWithMockedTracker({
      enabled: true,
      start: () => {
        calls += 1
        if (calls === 1) return Promise.reject('app is null')
        return Promise.resolve({ success: true } as StartResult)
      },
    })
    mod.startOpenReplay()
    await expect(mod.getTracker()).resolves.toBeNull()

    mod.startOpenReplay()
    await expect(mod.getTracker()).resolves.not.toBeNull()
    expect(start).toHaveBeenCalledTimes(2)
    expect(construct).toHaveBeenCalledTimes(1)
  })

  it('resolves to the tracker on a successful start', async () => {
    const { mod } = await loadWithMockedTracker({ enabled: true })

    mod.startOpenReplay()

    await expect(mod.getTracker()).resolves.not.toBeNull()
  })

  it('resolves to null when start() reports failure without throwing', async () => {
    // 🔴 The shape that would otherwise pass unnoticed: an unsuccessful start
    // RESOLVES with { success: false }, it does not reject.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { mod } = await loadWithMockedTracker({
      enabled: true,
      start: async () => ({ success: false, reason: 'doNotTrack' }),
    })

    mod.startOpenReplay()

    await expect(mod.getTracker()).resolves.toBeNull()
    expect(consoleError).toHaveBeenCalled()
  })

  it('resolves to null when the dynamic import fails, instead of rejecting', async () => {
    // Without the .catch this rejection reaches the chunk-load recovery, which
    // reloads the page — a stale tracker chunk after a deploy would then bounce
    // every operator's tab.
    const { mod } = await loadWithMockedTracker({ enabled: true, failImport: true })

    mod.startOpenReplay()

    await expect(mod.getTracker()).resolves.toBeNull()
  })

  it('hands the tracker a sanitizer that redacts credentials from URLs', async () => {
    const { mod, construct } = await loadWithMockedTracker({ enabled: true })

    mod.startOpenReplay()
    await mod.getTracker()

    const sanitized = sanitizerOf(construct)({
      url: 'wss://api.example.com/ws/transcribe?token=eyJhbGciOiJIUzI1NiJ9.secret&lang=uk',
    })

    expect(sanitized.url).toBe('wss://api.example.com/ws/transcribe?token=[REDACTED]&lang=uk')
  })

  it('hands the tracker a sanitizer that redacts credential headers', async () => {
    const { mod, construct } = await loadWithMockedTracker({ enabled: true })

    mod.startOpenReplay()
    await mod.getTracker()

    // Headers are captured independently of `capturePayload`, so this is the
    // path X-Internal-Api-Key would otherwise take into a recording.
    const sanitized = sanitizerOf(construct)({
      url: 'https://api.crm-prionex.online/api/v1/credit/loans',
      request: {
        headers: {
          'x-internal-api-key': 'stand-key-value',
          authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.x',
          'x-operator-role': 'operator',
        },
      },
      response: { headers: { 'set-cookie': 'session=abc' } },
    })

    expect(sanitized.request?.headers).toEqual({
      'x-internal-api-key': '[REDACTED]',
      authorization: '[REDACTED]',
      // Not a credential — it must survive, or the record loses its meaning.
      'x-operator-role': 'operator',
    })
    expect(sanitized.response?.headers).toEqual({ 'set-cookie': '[REDACTED]' })
  })

  it('redacts credential headers whatever their casing', async () => {
    // The package matches `ignoreHeaders` with `Array.includes`, i.e.
    // case-sensitively. axios lower-cases names, so the list matches today — but
    // a caller that bypasses axios must not slip a key through on capitalisation.
    const { mod, construct } = await loadWithMockedTracker({ enabled: true })

    mod.startOpenReplay()
    await mod.getTracker()

    const sanitized = sanitizerOf(construct)({
      url: 'https://api.crm-prionex.online/api/v1/credit/loans',
      request: { headers: { 'X-Internal-Api-Key': 'stand-key-value', Authorization: 'Bearer x' } },
    })

    expect(sanitized.request?.headers).toEqual({
      'X-Internal-Api-Key': '[REDACTED]',
      Authorization: '[REDACTED]',
    })
  })

  it('names the credential headers in ignoreHeaders as well as in the sanitizer', async () => {
    // Two mechanisms, one list: `ignoreHeaders` drops the header before it is
    // recorded, the sanitizer is the second line. They must not drift apart.
    const { mod, construct } = await loadWithMockedTracker({ enabled: true })

    mod.startOpenReplay()
    await mod.getTracker()

    const options = construct.mock.calls[0][0] as { network: { ignoreHeaders: string[] } }

    expect(options.network.ignoreHeaders).toEqual(
      expect.arrayContaining(['cookie', 'set-cookie', 'authorization', 'x-internal-api-key'])
    )
  })
})

describe('redactSensitiveQueryParams', () => {
  it.each([
    ['https://x.dev/a?token=abc', 'https://x.dev/a?token=[REDACTED]'],
    ['https://x.dev/a?access_token=abc&b=1', 'https://x.dev/a?access_token=[REDACTED]&b=1'],
    ['https://x.dev/a?b=1&api_key=abc#frag', 'https://x.dev/a?b=1&api_key=[REDACTED]#frag'],
    ['https://x.dev/a?TOKEN=abc', 'https://x.dev/a?TOKEN=[REDACTED]'],
    // Real URLs, captured today: FetchProxy records the URL even though
    // capturePayload is false, and both carry a third party's PII.
    [
      'https://x.dev/api/v1/calls/last-by-phone?phone=380978170286',
      'https://x.dev/api/v1/calls/last-by-phone?phone=[REDACTED]',
    ],
    [
      'https://x.dev/api/v1/clients/search/tin?tin=1234567890',
      'https://x.dev/api/v1/clients/search/tin?tin=[REDACTED]',
    ],
  ])('redacts %j', async (input, expected) => {
    const { redactSensitiveQueryParams } = await import('../index')

    expect(redactSensitiveQueryParams(input)).toBe(expected)
  })

  it('does not redact a parameter that merely ends in one of the names', async () => {
    // The names are anchored to ?/&, so a longer parameter keeps its value —
    // otherwise `sorting`, `latin` or `headphone` would be redacted for the
    // sake of `tin` and `phone`.
    const { redactSensitiveQueryParams } = await import('../index')
    const url = 'https://x.dev/a?latin=1&headphone=2&sorting=3'

    expect(redactSensitiveQueryParams(url)).toBe(url)
  })

  it('leaves a URL without credentials untouched', async () => {
    const { redactSensitiveQueryParams } = await import('../index')
    const url = 'https://api.crm-prionex.online/api/v1/clients?page=2&search=ivan'

    expect(redactSensitiveQueryParams(url)).toBe(url)
  })
})
