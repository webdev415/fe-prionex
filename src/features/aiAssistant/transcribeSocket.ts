/**
 * WebSocket client for the server-side streaming STT proxy
 * (WS /api/v1/ai-assistant/ws/transcribe → assistant-gw /ws/transcribe).
 *
 * Wire contract (docs/ASSISTANT_VOICE.md of the gateway):
 *  - auth: `?token=<operator JWT>` query param (browser WS cannot send headers);
 *  - first frame: text JSON `{type:'start', mime, language?, glossary?}`;
 *  - then binary audio chunks (raw MediaRecorder blobs, 250–500ms each);
 *  - text JSON `{type:'stop'}` ends the recording;
 *  - server events: `session`, `transcript.draft` (FULL text, replaces the
 *    previous draft), `transcript.final`, `transcript.corrected`, `error`.
 *    After `error` the session is dead — reopen the socket to retry.
 */

import { api, getAccessToken } from '@/lib/api'

export const TRANSCRIBE_WS_PATH = '/api/v1/ai-assistant/ws/transcribe'

export interface TranscribeEvents {
  onDraft: (text: string) => void
  onFinal: (text: string) => void
  /** May never fire (corrector disabled / failed) — `final` is then the truth. */
  onCorrected: (text: string) => void
  /** Any failure: WS error/close before final, server `error` event, bad payload. */
  onError: (message: string) => void
}

export interface TranscribeSession {
  /** Forward one MediaRecorder chunk; silently dropped when the socket is not open. */
  sendChunk: (chunk: Blob) => void
  /** Send the stop frame — the server replies with `transcript.final`. */
  stop: () => void
  /** Hard-close the socket without waiting for final (cancel). */
  close: () => void
}

export interface TranscribeOptions {
  mime?: string
  /** Whisper language hint; omit for auto-detection. */
  language?: string
  events: TranscribeEvents
}

export function buildTranscribeUrl(): string {
  const base = api.defaults.baseURL || ''
  const httpBase =
    base ||
    (typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost')
  const wsBase = httpBase.replace(/^http/i, 'ws')
  const token = getAccessToken() ?? ''
  return `${wsBase}${TRANSCRIBE_WS_PATH}?token=${encodeURIComponent(token)}`
}

/**
 * Open a transcription session. The socket is opened immediately; the start
 * frame is sent on `open`. Returns control handles; all server traffic is
 * reported through `events`.
 */
export function openTranscribeSession(options: TranscribeOptions): TranscribeSession {
  const { events } = options
  const ws = new WebSocket(buildTranscribeUrl())
  ws.binaryType = 'arraybuffer'

  let gotFinal = false
  let gotCorrected = false
  let closedByClient = false
  let failed = false

  const fail = (message: string) => {
    if (failed || gotFinal) return
    failed = true
    events.onError(message)
  }

  ws.onopen = () => {
    const start: Record<string, unknown> = {
      type: 'start',
      mime: options.mime ?? 'audio/webm',
    }
    if (options.language) start.language = options.language
    ws.send(JSON.stringify(start))
  }

  ws.onmessage = (event: MessageEvent) => {
    if (typeof event.data !== 'string') return
    let payload: { type?: string; text?: string; message?: string }
    try {
      payload = JSON.parse(event.data) as typeof payload
    } catch {
      return
    }
    switch (payload.type) {
      case 'transcript.draft':
        if (typeof payload.text === 'string') events.onDraft(payload.text)
        break
      case 'transcript.final':
        gotFinal = true
        events.onFinal(typeof payload.text === 'string' ? payload.text : '')
        break
      case 'transcript.corrected':
        gotCorrected = true
        if (typeof payload.text === 'string') events.onCorrected(payload.text)
        // corrected is the last event of a session — nothing more to wait for.
        closedByClient = true
        ws.close()
        break
      case 'error':
        fail(payload.message ?? 'transcribe error')
        closedByClient = true
        ws.close()
        break
      default:
        // `session` and unknown events are informational.
        break
    }
  }

  ws.onerror = () => {
    fail('websocket error')
  }

  ws.onclose = () => {
    if (closedByClient || gotCorrected) return
    if (!gotFinal) {
      fail('websocket closed before final transcript')
    }
  }

  return {
    sendChunk: (chunk: Blob) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(chunk)
    },
    stop: () => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'stop' }))
    },
    close: () => {
      closedByClient = true
      try {
        ws.close()
      } catch {
        /* noop */
      }
    },
  }
}
