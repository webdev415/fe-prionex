/**
 * Server-side dictation: microphone → MediaRecorder (webm/opus, 300ms
 * timeslice) → WS /ai-assistant/ws/transcribe → live draft / final /
 * corrected transcripts.
 *
 * The hook owns the media + socket lifecycle and exposes a tiny state
 * machine; rendering the draft tail and committing text into the composer
 * stays in the page. Every failure path funnels into `onError` so the page
 * can gracefully fall back to the browser SpeechRecognition.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { openTranscribeSession, type TranscribeSession } from './transcribeSocket'

export type DictationStatus = 'idle' | 'listening' | 'finalizing'

export const DICTATION_TIMESLICE_MS = 300
/** stop → transcript.final client deadline (the gateway's own is 30s). */
export const DICTATION_FINAL_TIMEOUT_MS = 20_000

export interface UseServerDictationOptions {
  /** Whisper language hint ('ru' | 'uk' | …); empty → auto-detect. */
  language?: string
  /** Full draft text (replaces the previous draft). */
  onDraft: (text: string) => void
  /** Final ASR transcript — commit into the composer. */
  onFinal: (text: string) => void
  /** Layer-2 corrected text — replace the previously committed final. */
  onCorrected: (text: string) => void
  /**
   * Any failure (mic, WS, server error, final timeout). `phase` tells whether
   * speech could have been lost: 'start' fails before any audio was sent.
   */
  onError: (phase: 'start' | 'stream') => void
}

export interface UseServerDictation {
  status: DictationStatus
  start: () => Promise<void>
  /** Stop recording and wait for the final transcript. */
  stop: () => void
  /** Abort everything without waiting for final (unmount, hard reset). */
  cancel: () => void
}

function pickRecorderMime(): string {
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  }
  return 'audio/webm'
}

export function useServerDictation(options: UseServerDictationOptions): UseServerDictation {
  const [status, setStatus] = useState<DictationStatus>('idle')
  const sessionRef = useRef<TranscribeSession | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const finalTimerRef = useRef<number | null>(null)
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const cleanup = useCallback(() => {
    if (finalTimerRef.current != null) {
      window.clearTimeout(finalTimerRef.current)
      finalTimerRef.current = null
    }
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        /* noop */
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    sessionRef.current = null
    setStatus('idle')
  }, [])

  const cancel = useCallback(() => {
    const session = sessionRef.current
    sessionRef.current = null
    session?.close()
    cleanup()
  }, [cleanup])

  // Abort the session when the page unmounts mid-dictation.
  useEffect(() => cancel, [cancel])

  const start = useCallback(async () => {
    if (sessionRef.current || recorderRef.current) return

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      optionsRef.current.onError('start')
      return
    }
    streamRef.current = stream

    let startedStreaming = false
    const session = openTranscribeSession({
      mime: 'audio/webm',
      language: optionsRef.current.language || undefined,
      events: {
        onDraft: (text) => optionsRef.current.onDraft(text),
        onFinal: (text) => {
          if (finalTimerRef.current != null) {
            window.clearTimeout(finalTimerRef.current)
            finalTimerRef.current = null
          }
          optionsRef.current.onFinal(text)
          // Keep the socket open — `corrected` may still arrive; the session
          // closes itself on corrected/error, the recorder is already done.
          recorderRef.current = null
          streamRef.current?.getTracks().forEach((track) => track.stop())
          streamRef.current = null
          setStatus('idle')
        },
        onCorrected: (text) => {
          optionsRef.current.onCorrected(text)
          sessionRef.current = null
        },
        onError: () => {
          const phase = startedStreaming ? 'stream' : 'start'
          sessionRef.current = null
          cleanup()
          optionsRef.current.onError(phase)
        },
      },
    })
    sessionRef.current = session

    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType: pickRecorderMime() })
    } catch {
      session.close()
      cleanup()
      optionsRef.current.onError('start')
      return
    }
    recorderRef.current = recorder

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        startedStreaming = true
        session.sendChunk(event.data)
      }
    }
    recorder.onstop = () => {
      // The last `dataavailable` fired right before `stop` — flush done.
      session.stop()
      finalTimerRef.current = window.setTimeout(() => {
        sessionRef.current = null
        session.close()
        cleanup()
        optionsRef.current.onError('stream')
      }, DICTATION_FINAL_TIMEOUT_MS)
    }

    recorder.start(DICTATION_TIMESLICE_MS)
    setStatus('listening')
  }, [cleanup])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    setStatus('finalizing')
    try {
      recorder.stop()
    } catch {
      sessionRef.current?.close()
      sessionRef.current = null
      cleanup()
      optionsRef.current.onError('stream')
    }
  }, [cleanup])

  return { status, start, stop, cancel }
}
