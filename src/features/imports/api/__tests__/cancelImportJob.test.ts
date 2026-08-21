import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  default: mockApi,
  getAccessToken: () => 'test-token',
}))

import { cancelImportJob } from '../importsApi'

/**
 * The only_if_not_started flag is load-bearing for every import flow that
 * cleans up after a failed execute: useContactTagAssignment, useTagAssignment,
 * usePaymentImport, useOperatorAssignment and useSaleNotes all pass it.
 *
 * Dropping it does not break any of them visibly -- the cancel still succeeds --
 * it just starts cancelling imports that already began writing, aborting them at
 * the next batch boundary and leaving the file half-applied. Nothing else in the
 * suite would fail, so the parameter is asserted here directly.
 */
describe('cancelImportJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.post.mockResolvedValue({ data: { message: 'Import job cancelled successfully' } })
  })

  it('sends only_if_not_started when the option is set', async () => {
    await cancelImportJob(42, { onlyIfNotStarted: true })

    expect(mockApi.post).toHaveBeenCalledTimes(1)
    const [url, body, config] = mockApi.post.mock.calls[0]
    expect(url).toBe('/api/v1/import/jobs/42/cancel')
    expect(body).toBeUndefined()
    expect(config).toEqual({ params: { only_if_not_started: true } })
  })

  it('omits the parameter entirely when the option is not set', async () => {
    await cancelImportJob(42)

    const [, , config] = mockApi.post.mock.calls[0]
    // Not `{ params: {} }` and not `{ params: { only_if_not_started: false } }`:
    // an unconditional cancel must look exactly like it always did.
    expect(config).toBeUndefined()
  })

  it('omits the parameter when the option is explicitly false', async () => {
    await cancelImportJob(42, { onlyIfNotStarted: false })

    const [, , config] = mockApi.post.mock.calls[0]
    expect(config).toBeUndefined()
  })

  it('accepts a string job id', async () => {
    await cancelImportJob('abc-123', { onlyIfNotStarted: true })

    const [url] = mockApi.post.mock.calls[0]
    expect(url).toBe('/api/v1/import/jobs/abc-123/cancel')
  })

  it('surfaces the backend message, including the already-started one', async () => {
    // The endpoint answers 200 with this message when the job had already
    // started; it is not an error and must not be treated as one.
    mockApi.post.mockResolvedValue({
      data: { message: 'Import job already started; left running' },
    })

    const result = await cancelImportJob(42, { onlyIfNotStarted: true })

    expect(result.success).toBe(true)
    expect(result.message).toBe('Import job already started; left running')
  })
})
