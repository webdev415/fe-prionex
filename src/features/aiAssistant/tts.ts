/**
 * TTS playback for assistant replies: GET /api/v1/ai-assistant/tts streams a
 * chunked WAV synthesized by the gateway (Piper, docs/TTS.md). MSE has no
 * audio/wav support, so the stream is buffered into a Blob and played via an
 * object URL — Piper is faster than realtime, the wait is dominated by the
 * network. Voices: 'ru' | 'uk' (en falls back to 'ru').
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'

export type TtsVoice = 'ru' | 'uk'

export function resolveTtsVoice(language?: string): TtsVoice {
  return language?.startsWith('uk') ? 'uk' : 'ru'
}

/** Gateway cap: 1..4000 characters per request (docs/TTS.md). */
export const TTS_MAX_TEXT = 4000

/**
 * Assistant replies are markdown; reading `**`, `|` and `#` aloud is noise.
 * Light-touch plain-text conversion — enough for speech, not a renderer.
 */
export function prepareTtsText(markdown: string, maxLen: number = TTS_MAX_TEXT): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*{1,3}|_{1,3}|~{2})([^*_~]+)\1/g, '$2')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\|?[-:| ]+\|?\s*$/gm, ' ')
    .replace(/\|/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, maxLen)
}

export async function fetchTtsAudio(text: string, voice: TtsVoice): Promise<Blob> {
  const response = await api.get<Blob>('/api/v1/ai-assistant/tts', {
    params: { text, voice },
    responseType: 'blob',
    // Synthesis of a long reply plus a cold voice load can exceed the default
    // 30s api timeout.
    timeout: 60_000,
  })
  return response.data
}

export interface UseTtsPlayer {
  /** Message id currently being fetched (spinner state). */
  loadingId: string | null
  /** Message id currently playing. */
  playingId: string | null
  /** Start playback for the message, or stop it when already playing. */
  toggle: (id: string, text: string, voice: TtsVoice) => void
  stop: () => void
}

export function useTtsPlayer(onError: () => void): UseTtsPlayer {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)
  const requestTokenRef = useRef(0)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  const stop = useCallback(() => {
    requestTokenRef.current += 1
    const audio = audioRef.current
    audioRef.current = null
    if (audio) {
      try {
        audio.pause()
      } catch {
        /* noop */
      }
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setLoadingId(null)
    setPlayingId(null)
  }, [])

  useEffect(() => stop, [stop])

  const toggle = useCallback(
    (id: string, text: string, voice: TtsVoice) => {
      if (playingId === id || loadingId === id) {
        stop()
        return
      }
      stop()
      const token = ++requestTokenRef.current
      setLoadingId(id)
      fetchTtsAudio(text, voice)
        .then((blob) => {
          if (token !== requestTokenRef.current) return
          const url = URL.createObjectURL(blob)
          urlRef.current = url
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => {
            if (token === requestTokenRef.current) stop()
          }
          audio.onerror = () => {
            if (token === requestTokenRef.current) {
              stop()
              onErrorRef.current()
            }
          }
          setLoadingId(null)
          setPlayingId(id)
          void audio.play()?.catch(() => {
            if (token === requestTokenRef.current) {
              stop()
              onErrorRef.current()
            }
          })
        })
        .catch(() => {
          if (token !== requestTokenRef.current) return
          setLoadingId(null)
          onErrorRef.current()
        })
    },
    [loadingId, playingId, stop]
  )

  return { loadingId, playingId, toggle, stop }
}
