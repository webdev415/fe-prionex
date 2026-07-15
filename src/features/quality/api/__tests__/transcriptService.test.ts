/**
 * Call QA transcript service tests (Ф1).
 *
 * The endpoint is tri-state (200 ready / 202 processing / 404 missing) — the
 * service normalises the two success shapes into a discriminated union so the
 * hook and panel never branch on raw HTTP codes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

import { getCallTranscript, transcriptKeys } from '../transcriptService'

const TRANSCRIPT = {
  language: 'uk',
  duration_s: 63,
  summary: 'Тестове резюме.',
  utterances: [{ i: 0, t0: 0.4, t1: 3.1, role: 'operator', text: 'Доброго дня.', flags: [] }],
  scenes: [{ key: 'greeting', from_utt: 0, to_utt: 0 }],
}

describe('transcriptService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hits the quality transcripts endpoint', async () => {
    mockApi.get.mockResolvedValue({
      status: 200,
      data: { transcript: TRANSCRIPT, review: null },
    })
    await getCallTranscript('call-1')
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/quality/transcripts/call-1')
  })

  it('maps 200 with a body to ready', async () => {
    mockApi.get.mockResolvedValue({
      status: 200,
      data: { transcript: TRANSCRIPT, review: null },
    })
    const result = await getCallTranscript('call-1')
    expect(result.state).toBe('ready')
    if (result.state === 'ready') {
      expect(result.transcript.utterances).toHaveLength(1)
      expect(result.review).toBeNull()
    }
  })

  it('keeps the review when present (Ф2 payload)', async () => {
    mockApi.get.mockResolvedValue({
      status: 200,
      data: { transcript: TRANSCRIPT, review: { weighted_score: 74.5 } },
    })
    const result = await getCallTranscript('call-1')
    expect(result.state).toBe('ready')
    if (result.state === 'ready') {
      expect(result.review?.weighted_score).toBe(74.5)
    }
  })

  it('maps 202 {status} to not_ready', async () => {
    mockApi.get.mockResolvedValue({ status: 202, data: { status: 'pending' } })
    const result = await getCallTranscript('call-2')
    expect(result).toEqual({ state: 'not_ready', status: 'pending' })
  })

  it('treats a 200 without transcript body as not_ready (tolerant reader)', async () => {
    mockApi.get.mockResolvedValue({ status: 200, data: {} })
    const result = await getCallTranscript('call-3')
    expect(result.state).toBe('not_ready')
  })

  it('builds stable query keys', () => {
    expect(transcriptKeys.detail('abc')).toEqual(['quality', 'transcripts', 'detail', 'abc'])
  })
})
