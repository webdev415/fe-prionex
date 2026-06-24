import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildTranscribeUrl,
  openTranscribeSession,
  type TranscribeEvents,
} from '../transcribeSocket'
import { setAccessToken } from '@/lib/api'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState = MockWebSocket.CONNECTING
  binaryType = 'blob'
  sent: unknown[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(data: unknown) {
    this.sent.push(data)
  }

  close() {
    if (this.readyState === MockWebSocket.CLOSED) return
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  // --- test helpers ---
  serverOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  serverEvent(payload: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

function makeEvents(): TranscribeEvents & {
  drafts: string[]
  finals: string[]
  corrected: string[]
  errors: string[]
} {
  const drafts: string[] = []
  const finals: string[] = []
  const corrected: string[] = []
  const errors: string[] = []
  return {
    drafts,
    finals,
    corrected,
    errors,
    onDraft: (text) => drafts.push(text),
    onFinal: (text) => finals.push(text),
    onCorrected: (text) => corrected.push(text),
    onError: (message) => errors.push(message),
  }
}

describe('transcribeSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    setAccessToken('test-jwt')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  it('builds the WS url from the API base with the JWT as query param', () => {
    const url = buildTranscribeUrl()
    expect(url).toMatch(/^wss?:\/\//)
    expect(url).toContain('/api/v1/ai-assistant/ws/transcribe')
    expect(url).toContain('token=test-jwt')
  })

  it('sends the start frame on open and forwards audio chunks', () => {
    const events = makeEvents()
    const session = openTranscribeSession({ language: 'ru', events })
    const ws = MockWebSocket.instances[0]

    // Chunks before the socket is open are dropped, not queued.
    session.sendChunk(new Blob(['early']))
    expect(ws.sent).toHaveLength(0)

    ws.serverOpen()
    expect(ws.sent).toHaveLength(1)
    expect(JSON.parse(ws.sent[0] as string)).toEqual({
      type: 'start',
      mime: 'audio/webm',
      language: 'ru',
    })

    const chunk = new Blob(['audio-bytes'])
    session.sendChunk(chunk)
    expect(ws.sent[1]).toBe(chunk)

    session.stop()
    expect(JSON.parse(ws.sent[2] as string)).toEqual({ type: 'stop' })
  })

  it('omits the language hint when not provided (server auto-detect)', () => {
    openTranscribeSession({ events: makeEvents() })
    const ws = MockWebSocket.instances[0]
    ws.serverOpen()
    expect(JSON.parse(ws.sent[0] as string)).toEqual({ type: 'start', mime: 'audio/webm' })
  })

  it('dispatches draft, final and corrected transcripts in order', () => {
    const events = makeEvents()
    openTranscribeSession({ events })
    const ws = MockWebSocket.instances[0]
    ws.serverOpen()

    ws.serverEvent({ type: 'session', stream_id: 'sid-1' })
    ws.serverEvent({ type: 'transcript.draft', text: 'прив', seq: 1 })
    ws.serverEvent({ type: 'transcript.draft', text: 'привет мир', seq: 2 })
    ws.serverEvent({ type: 'transcript.final', text: 'Привет мир', stt_ms: 900 })
    ws.serverEvent({ type: 'transcript.corrected', text: 'Привет, мир!', corrector_ms: 500 })

    expect(events.drafts).toEqual(['прив', 'привет мир'])
    expect(events.finals).toEqual(['Привет мир'])
    expect(events.corrected).toEqual(['Привет, мир!'])
    expect(events.errors).toEqual([])
    // corrected is the last event — the client closes the socket itself.
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('reports a server error event exactly once', () => {
    const events = makeEvents()
    openTranscribeSession({ events })
    const ws = MockWebSocket.instances[0]
    ws.serverOpen()

    ws.serverEvent({ type: 'error', message: 'limit exceeded' })

    expect(events.errors).toEqual(['limit exceeded'])
    // The close that follows the error must not produce a second callback.
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('reports an error when the socket closes before the final transcript', () => {
    const events = makeEvents()
    openTranscribeSession({ events })
    const ws = MockWebSocket.instances[0]
    ws.serverOpen()
    ws.serverEvent({ type: 'transcript.draft', text: 'нач', seq: 1 })

    ws.close()

    expect(events.errors).toHaveLength(1)
    expect(events.finals).toEqual([])
  })

  it('does not report an error when the socket closes after final without corrected', () => {
    const events = makeEvents()
    openTranscribeSession({ events })
    const ws = MockWebSocket.instances[0]
    ws.serverOpen()
    ws.serverEvent({ type: 'transcript.final', text: 'готово' })

    ws.close()

    expect(events.errors).toEqual([])
    expect(events.finals).toEqual(['готово'])
  })

  it('close() cancels the session silently', () => {
    const events = makeEvents()
    const session = openTranscribeSession({ events })
    const ws = MockWebSocket.instances[0]
    ws.serverOpen()

    session.close()

    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
    expect(events.errors).toEqual([])
  })
})
