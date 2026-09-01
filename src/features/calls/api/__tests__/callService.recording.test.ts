/**
 * fetchRecordingBlob resilience tests (KAN-1030 / KAN-1023).
 *
 * The recording endpoint sometimes answers 200 and cuts the body short. The
 * service must compare the received blob against Content-Length and reject
 * with RecordingTruncatedError instead of returning a silently shortened
 * recording. It also forwards the abort signal and download progress so the
 * player can cancel and show a percentage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { callService, RecordingTruncatedError } from '../callService'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ default: mockApi }))

const blobOfSize = (size: number) => new Blob([new Uint8Array(size)], { type: 'audio/wav' })

describe('callService.fetchRecordingBlob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects with RecordingTruncatedError when fewer bytes arrive than Content-Length', async () => {
    mockApi.get.mockResolvedValue({
      data: blobOfSize(392),
      headers: { 'content-length': '9370' },
    })

    const error = await callService.fetchRecordingBlob('CALL-1').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(RecordingTruncatedError)
    expect((error as RecordingTruncatedError).expectedBytes).toBe(9370)
    expect((error as RecordingTruncatedError).receivedBytes).toBe(392)
  })

  it('resolves when the full body arrives', async () => {
    mockApi.get.mockResolvedValue({
      data: blobOfSize(9370),
      headers: { 'content-length': '9370' },
    })

    const blob = await callService.fetchRecordingBlob('CALL-1')
    expect(blob.size).toBe(9370)
  })

  it('resolves when Content-Length is absent (no basis to call it truncated)', async () => {
    mockApi.get.mockResolvedValue({ data: blobOfSize(392), headers: {} })

    await expect(callService.fetchRecordingBlob('CALL-1')).resolves.toBeInstanceOf(Blob)
  })

  it('forwards the abort signal and reports progress in bytes', async () => {
    mockApi.get.mockResolvedValue({
      data: blobOfSize(100),
      headers: { 'content-length': '100' },
    })
    const controller = new AbortController()
    const onProgress = vi.fn()

    await callService.fetchRecordingBlob('CALL-1', { signal: controller.signal, onProgress })

    const config = mockApi.get.mock.calls[0][1] as {
      signal?: AbortSignal
      onDownloadProgress?: (event: { loaded: number; total?: number }) => void
    }
    expect(config.signal).toBe(controller.signal)

    config.onDownloadProgress?.({ loaded: 50, total: 100 })
    expect(onProgress).toHaveBeenCalledWith({ loadedBytes: 50, totalBytes: 100 })

    // No Content-Length on the wire → total is unknown, not zero.
    config.onDownloadProgress?.({ loaded: 50 })
    expect(onProgress).toHaveBeenLastCalledWith({ loadedBytes: 50, totalBytes: null })
  })
})
