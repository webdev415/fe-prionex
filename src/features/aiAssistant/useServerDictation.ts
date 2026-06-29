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

/** RMS level under which a frame counts as silence for the VAD auto-stop. */
const VAD_SILENCE_RMS = 0.012

export interface UseServerDictationOptions {
  /** Whisper language hint ('ru' | 'uk' | …); empty → auto-detect. */
  language?: string
  /**
   * Auto-stop after this many seconds of continuous silence once the user has
   * started speaking (VAD via a Web Audio analyser). Omit / 0 to disable.
   */
  silenceTimeoutSec?: number
  /** Hard stop: cut the recording off after this many seconds. Omit to disable. */
  maxDurationSec?: number
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
  const maxTimerRef = useRef<number | null>(null)
  // VAD analyser plumbing (Web Audio). Torn down with the recorder.
  const audioCtxRef = useRef<AudioContext | null>(null)
  const vadRafRef = useRef<number | null>(null)
  // Set once the user is detected speaking; only then does silence auto-stop.
  const spokeRef = useRef(false)
  const silenceStartRef = useRef<number | null>(null)
  // Late-bound stop so the VAD/timer loops can finalize without a declaration cycle.
  const stopRef = useRef<() => void>(() => {})
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const teardownVad = useCallback(() => {
    if (vadRafRef.current != null) {
      window.cancelAnimationFrame(vadRafRef.current)
      vadRafRef.current = null
    }
    const ctx = audioCtxRef.current
    audioCtxRef.current = null
    if (ctx && ctx.state !== 'closed') {
      void ctx.close().catch(() => {})
    }
    spokeRef.current = false
    silenceStartRef.current = null
  }, [])

  const cleanup = useCallback(() => {
    if (finalTimerRef.current != null) {
      window.clearTimeout(finalTimerRef.current)
      finalTimerRef.current = null
    }
    if (maxTimerRef.current != null) {
      window.clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    teardownVad()
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
  }, [teardownVad])

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
          if (maxTimerRef.current != null) {
            window.clearTimeout(maxTimerRef.current)
            maxTimerRef.current = null
          }
          teardownVad()
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

    // Hard cap: cut the recording off after maxDurationSec (timer-based stop).
    const maxDurationSec = optionsRef.current.maxDurationSec
    if (maxDurationSec && maxDurationSec > 0) {
      maxTimerRef.current = window.setTimeout(() => {
        maxTimerRef.current = null
        stopRef.current()
      }, maxDurationSec * 1000)
    }

    // VAD auto-stop: tap the same stream with an analyser and stop after
    // silenceTimeoutSec of continuous quiet once speech has been detected.
    const silenceTimeoutSec = optionsRef.current.silenceTimeoutSec
    const AudioCtor =
      typeof window !== 'undefined'
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined
    if (silenceTimeoutSec && silenceTimeoutSec > 0 && AudioCtor) {
      try {
        const ctx = new AudioCtor()
        audioCtxRef.current = ctx
        const sourceNode = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        sourceNode.connect(analyser)
        const buffer = new Float32Array(analyser.fftSize)
        spokeRef.current = false
        silenceStartRef.current = null

        const tick = () => {
          const node = audioCtxRef.current
          if (!node || recorderRef.current?.state !== 'recording') return
          analyser.getFloatTimeDomainData(buffer)
          let sum = 0
          for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i]
          const rms = Math.sqrt(sum / buffer.length)
          const now = Date.now()
          if (rms >= VAD_SILENCE_RMS) {
            spokeRef.current = true
            silenceStartRef.current = null
          } else if (spokeRef.current) {
            if (silenceStartRef.current == null) {
              silenceStartRef.current = now
            } else if (now - silenceStartRef.current >= silenceTimeoutSec * 1000) {
              stopRef.current()
              return
            }
          }
          vadRafRef.current = window.requestAnimationFrame(tick)
        }
        vadRafRef.current = window.requestAnimationFrame(tick)
      } catch {
        // Web Audio unavailable / blocked — silently fall back to manual stop.
        teardownVad()
      }
    }
  }, [cleanup, teardownVad])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    // VAD / max-timer no longer need to fire — the stop is happening now.
    teardownVad()
    if (maxTimerRef.current != null) {
      window.clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
    setStatus('finalizing')
    try {
      recorder.stop()
    } catch {
      sessionRef.current?.close()
      sessionRef.current = null
      cleanup()
      optionsRef.current.onError('stream')
    }
  }, [cleanup, teardownVad])

  // Late-bind stop so the VAD / max-duration loops in `start` can finalize.
  useEffect(() => {
    stopRef.current = stop
  }, [stop])

  return { status, start, stop, cancel }
}
