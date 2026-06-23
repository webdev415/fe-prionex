/**
 * Voice-message recorder: long-press on the mic records an audio note that is
 * sent to POST /chat as an `audio` attachment (backend PR #638 — the gateway
 * transcribes it server-side). Limits mirror the backend: ≤10MB decoded,
 * recording auto-stops at 120s.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_AUDIO_BYTES, MAX_VOICE_MESSAGE_SECONDS } from './attachments'

export type VoiceRecorderStatus = 'idle' | 'recording'

export interface VoiceMessageResult {
  blob: Blob
  mime: string
  durationSec: number
}

export interface UseVoiceMessageRecorderOptions {
  /** Recording finished (stop button / 120s cap) — send the message. */
  onComplete: (result: VoiceMessageResult) => void
  /** Mic unavailable / recorder failure / size cap exceeded. */
  onError: (reason: 'mic' | 'tooLarge') => void
}

export interface UseVoiceMessageRecorder {
  status: VoiceRecorderStatus
  /** Elapsed seconds, ticks once a second while recording. */
  elapsedSec: number
  start: () => Promise<void>
  /** Finish recording and emit the result through onComplete. */
  stop: () => void
  /** Discard the recording without sending. */
  cancel: () => void
}

function pickAudioMime(): string {
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  }
  return 'audio/webm'
}

export function useVoiceMessageRecorder(
  options: UseVoiceMessageRecorderOptions
): UseVoiceMessageRecorder {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const discardRef = useRef(false)
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const teardown = useCallback(() => {
    if (tickerRef.current != null) {
      window.clearInterval(tickerRef.current)
      tickerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    setStatus('idle')
    setElapsedSec(0)
  }, [])

  const finishRecorder = useCallback(
    (discard: boolean) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') return
      discardRef.current = discard
      try {
        recorder.stop()
      } catch {
        teardown()
      }
    },
    [teardown]
  )

  const stop = useCallback(() => finishRecorder(false), [finishRecorder])
  const cancel = useCallback(() => finishRecorder(true), [finishRecorder])

  // Discard a recording left running on unmount.
  useEffect(() => {
    return () => {
      discardRef.current = true
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          /* noop */
        }
      }
      if (tickerRef.current != null) window.clearInterval(tickerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const start = useCallback(async () => {
    if (recorderRef.current) return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      optionsRef.current.onError('mic')
      return
    }
    streamRef.current = stream

    const mime = pickAudioMime()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime })
    } catch {
      teardown()
      optionsRef.current.onError('mic')
      return
    }
    recorderRef.current = recorder
    chunksRef.current = []
    discardRef.current = false
    startedAtRef.current = Date.now()

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      const discarded = discardRef.current
      const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000)
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      teardown()
      if (discarded) return
      if (blob.size === 0) return
      if (blob.size > MAX_AUDIO_BYTES) {
        optionsRef.current.onError('tooLarge')
        return
      }
      optionsRef.current.onComplete({ blob, mime: 'audio/webm', durationSec })
    }

    recorder.start(1000)
    setStatus('recording')
    setElapsedSec(0)
    tickerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setElapsedSec(elapsed)
      if (elapsed >= MAX_VOICE_MESSAGE_SECONDS) {
        finishRecorder(false)
      }
    }, 1000)
  }, [finishRecorder, teardown])

  return { status, elapsedSec, start, stop, cancel }
}
