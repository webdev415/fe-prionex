import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'

vi.mock('@/features/aiAssistant/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/aiAssistant/api')>()
  return {
    ...actual,
    getConversation: vi.fn(),
    getConversations: vi.fn().mockResolvedValue([]),
    sendChatMessage: vi.fn(),
    sendFeedback: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { toast } from 'sonner'

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

  serverOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  serverEvent(payload: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = []
  static isTypeSupported = () => true

  state: 'inactive' | 'recording' = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  stream: unknown
  options: unknown

  constructor(stream: unknown, options?: unknown) {
    this.stream = stream
    this.options = options
    MockMediaRecorder.instances.push(this)
  }

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.onstop?.()
  }
}

class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = []
  continuous = false
  interimResults = false
  lang = ''
  onresult: ((ev: unknown) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()

  constructor() {
    MockSpeechRecognition.instances.push(this)
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

function getTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText('pages.aiAssistant.inputPlaceholder') as HTMLTextAreaElement
}

async function startDictationAndOpenSocket(): Promise<MockWebSocket> {
  fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.voiceStartRecording' }))
  await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))
  const ws = MockWebSocket.instances[0]
  act(() => ws.serverOpen())
  await waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(1))
  return ws
}

describe('AiAssistantBetaPage server dictation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    MockWebSocket.instances = []
    MockMediaRecorder.instances = []
    MockSpeechRecognition.instances = []
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
      },
      configurable: true,
    })
    ;(window as unknown as Record<string, unknown>).SpeechRecognition = MockSpeechRecognition
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as unknown as Record<string, unknown>).SpeechRecognition
  })

  it('streams drafts as a grey tail and commits final + corrected into the textarea', async () => {
    renderPage()
    const ws = await startDictationAndOpenSocket()

    expect(JSON.parse(ws.sent[0] as string)).toMatchObject({ type: 'start', mime: 'audio/webm' })

    act(() => {
      ws.serverEvent({ type: 'session', stream_id: 'sid' })
      ws.serverEvent({ type: 'transcript.draft', text: 'покажи долг', seq: 1 })
    })
    // The draft is a non-editable ghost tail, not textarea content.
    expect(screen.getByTestId('dictation-ghost')).toHaveTextContent('покажи долг')
    expect(getTextarea().value).toBe('')

    // Stop via the mic button → recorder flushes → stop frame → final.
    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.voiceStopRecording' }))
    await waitFor(() => {
      expect(ws.sent.some((f) => typeof f === 'string' && f.includes('"stop"'))).toBe(true)
    })

    act(() => {
      ws.serverEvent({ type: 'transcript.final', text: 'Покажи долг клиента', stt_ms: 900 })
    })
    expect(getTextarea().value).toBe('Покажи долг клиента')
    expect(screen.queryByTestId('dictation-ghost')).not.toBeInTheDocument()

    act(() => {
      ws.serverEvent({
        type: 'transcript.corrected',
        text: 'Покажи долг клиента.',
        corrector_ms: 400,
      })
    })
    expect(getTextarea().value).toBe('Покажи долг клиента.')
  })

  it('appends the dictated text after already typed text', async () => {
    renderPage()
    fireEvent.change(getTextarea(), { target: { value: 'Клиент 42:' } })
    const ws = await startDictationAndOpenSocket()

    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.voiceStopRecording' }))
    act(() => {
      ws.serverEvent({ type: 'transcript.final', text: 'сумма долга' })
    })
    expect(getTextarea().value).toBe('Клиент 42: сумма долга')
  })

  it('does not apply corrected when the user already edited the final text', async () => {
    renderPage()
    const ws = await startDictationAndOpenSocket()

    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.voiceStopRecording' }))
    act(() => {
      ws.serverEvent({ type: 'transcript.final', text: 'итоговый текст' })
    })
    fireEvent.change(getTextarea(), { target: { value: 'итоговый текст, дополнено' } })

    act(() => {
      ws.serverEvent({ type: 'transcript.corrected', text: 'Итоговый текст.' })
    })
    expect(getTextarea().value).toBe('итоговый текст, дополнено')
  })

  it('Escape stops the dictation', async () => {
    renderPage()
    const ws = await startDictationAndOpenSocket()

    fireEvent.keyDown(window, { key: 'Escape' })

    await waitFor(() => {
      expect(ws.sent.some((f) => typeof f === 'string' && f.includes('"stop"'))).toBe(true)
    })
  })

  it('falls back to browser SpeechRecognition with a toast when the WS fails', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.voiceStartRecording' }))
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.onerror?.()
      ws.close()
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.voiceFallback')
    })
    expect(MockSpeechRecognition.instances).toHaveLength(1)
    expect(MockSpeechRecognition.instances[0].start).toHaveBeenCalled()
  })

  it('falls back when the server reports an error mid-stream', async () => {
    renderPage()
    const ws = await startDictationAndOpenSocket()

    act(() => {
      ws.serverEvent({ type: 'error', message: 'whisper died' })
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.voiceFallback')
    })
    expect(MockSpeechRecognition.instances).toHaveLength(1)
  })
})
