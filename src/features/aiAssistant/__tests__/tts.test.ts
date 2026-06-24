import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { prepareTtsText, resolveTtsVoice, useTtsPlayer, TTS_MAX_TEXT } from '../tts'
import { api } from '@/lib/api'

describe('resolveTtsVoice', () => {
  it('maps uk → uk, everything else (ru/en/unknown) → ru', () => {
    expect(resolveTtsVoice('uk')).toBe('uk')
    expect(resolveTtsVoice('uk-UA')).toBe('uk')
    expect(resolveTtsVoice('ru')).toBe('ru')
    expect(resolveTtsVoice('en')).toBe('ru')
    expect(resolveTtsVoice(undefined)).toBe('ru')
  })
})

describe('prepareTtsText', () => {
  it('strips markdown noise for speech', () => {
    const md = '## Итог\n\nУ клиента **2 договора** и `id 42`.\n\n- первый\n- второй'
    const text = prepareTtsText(md)
    expect(text).not.toContain('#')
    expect(text).not.toContain('**')
    expect(text).not.toContain('`')
    expect(text).toContain('Итог')
    expect(text).toContain('2 договора')
    expect(text).toContain('id 42')
  })

  it('flattens tables and drops code blocks', () => {
    const md = '| Имя | Долг |\n|---|---|\n| Иван | 100 |\n\n```sql\nSELECT 1\n```'
    const text = prepareTtsText(md)
    expect(text).not.toContain('|')
    expect(text).not.toContain('SELECT')
    expect(text).toContain('Иван')
  })

  it('truncates to the gateway cap', () => {
    const text = prepareTtsText('a'.repeat(TTS_MAX_TEXT + 500))
    expect(text).toHaveLength(TTS_MAX_TEXT)
  })
})

class MockAudio {
  static instances: MockAudio[] = []
  src: string
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()

  constructor(src: string) {
    this.src = src
    MockAudio.instances.push(this)
  }
}

describe('useTtsPlayer', () => {
  beforeEach(() => {
    MockAudio.instances = []
    vi.stubGlobal('Audio', MockAudio)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:tts'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches the audio, plays it, and a second toggle stops playback', async () => {
    const getSpy = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: new Blob(['wav'], { type: 'audio/wav' }) })
    const onError = vi.fn()
    const { result } = renderHook(() => useTtsPlayer(onError))

    act(() => {
      result.current.toggle('msg-1', 'Привет', 'ru')
    })
    expect(result.current.loadingId).toBe('msg-1')

    await waitFor(() => expect(result.current.playingId).toBe('msg-1'))
    expect(getSpy).toHaveBeenCalledWith(
      '/api/v1/ai-assistant/tts',
      expect.objectContaining({
        params: { text: 'Привет', voice: 'ru' },
        responseType: 'blob',
      })
    )
    expect(MockAudio.instances).toHaveLength(1)
    expect(MockAudio.instances[0].play).toHaveBeenCalled()

    act(() => {
      result.current.toggle('msg-1', 'Привет', 'ru')
    })
    expect(result.current.playingId).toBeNull()
    expect(MockAudio.instances[0].pause).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports an error when the request fails', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('504'))
    const onError = vi.fn()
    const { result } = renderHook(() => useTtsPlayer(onError))

    act(() => {
      result.current.toggle('msg-1', 'Привет', 'uk')
    })

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1))
    expect(result.current.playingId).toBeNull()
    expect(result.current.loadingId).toBeNull()
  })

  it('playback end resets the state', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: new Blob(['wav']) })
    const { result } = renderHook(() => useTtsPlayer(vi.fn()))

    act(() => {
      result.current.toggle('msg-2', 'Текст', 'ru')
    })
    await waitFor(() => expect(result.current.playingId).toBe('msg-2'))

    act(() => {
      MockAudio.instances[0].onended?.()
    })
    expect(result.current.playingId).toBeNull()
  })
})
