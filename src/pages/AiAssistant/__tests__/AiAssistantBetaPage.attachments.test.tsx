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
import { sendChatMessage } from '@/features/aiAssistant/api'

const mockedSendChatMessage = vi.mocked(sendChatMessage)

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

function makeImageFile(name = 'shot.png', type = 'image/png', content = 'png-bytes'): File {
  return new File([content], name, { type })
}

function pasteFiles(files: File[]) {
  fireEvent.paste(getTextarea(), {
    clipboardData: {
      items: files.map((file) => ({ kind: 'file', getAsFile: () => file })),
    },
  })
}

describe('AiAssistantBetaPage attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    MockMediaRecorder.instances = []
    Element.prototype.scrollIntoView = vi.fn()
    vi.stubGlobal('MediaRecorder', MockMediaRecorder)
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
      },
      configurable: true,
    })
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random().toString(36).slice(2, 8)}`)
    URL.revokeObjectURL = vi.fn()
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
    mockedSendChatMessage.mockResolvedValue({
      conversation_id: 1,
      message_id: 5,
      response: 'Готово',
      coverage_flag: null,
      tool_calls: [],
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a preview chip for a pasted screenshot and removes it via the cross', async () => {
    renderPage()
    pasteFiles([makeImageFile()])

    const chips = await screen.findByTestId('pending-attachments')
    expect(chips.querySelectorAll('img')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.attachImageRemove' }))
    expect(screen.queryByTestId('pending-attachments')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it('caps pasted images at 3 and warns about the overflow', async () => {
    renderPage()
    pasteFiles([
      makeImageFile('1.png'),
      makeImageFile('2.png'),
      makeImageFile('3.png'),
      makeImageFile('4.png'),
    ])

    const chips = await screen.findByTestId('pending-attachments')
    await waitFor(() => expect(chips.querySelectorAll('img')).toHaveLength(3))
    expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachImageTooMany')
  })

  it('rejects unsupported types and oversized images', async () => {
    renderPage()
    pasteFiles([makeImageFile('a.gif', 'image/gif')])
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachImageUnsupported')
    )

    const big = makeImageFile('big.png')
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 })
    pasteFiles([big])
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachImageTooLarge')
    )
    expect(screen.queryByTestId('pending-attachments')).not.toBeInTheDocument()
  })

  it('sends pasted images with the text and renders the thumbnail in the feed', async () => {
    renderPage()
    pasteFiles([makeImageFile()])
    await screen.findByTestId('pending-attachments')

    fireEvent.change(getTextarea(), { target: { value: 'что на скрине?' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'что на скрине?',
        attachments: [{ type: 'image', mime: 'image/png', data_b64: btoa('png-bytes') }],
      })
    )
    // The composer chips are consumed; the bubble shows the thumbnail.
    expect(screen.queryByTestId('pending-attachments')).not.toBeInTheDocument()
    expect(await screen.findByAltText('pages.aiAssistant.attachedImageAlt')).toBeInTheDocument()
  })

  it('does not send an image without text and explains why', async () => {
    renderPage()
    pasteFiles([makeImageFile()])
    await screen.findByTestId('pending-attachments')

    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachmentNeedsText')
    )
    expect(mockedSendChatMessage).not.toHaveBeenCalled()
    // The chip stays so the user can add text and retry.
    expect(screen.getByTestId('pending-attachments')).toBeInTheDocument()
  })

  it('long-press records a voice message and sends it as an audio attachment', async () => {
    renderPage()
    const mic = screen.getByRole('button', { name: 'pages.aiAssistant.voiceStartRecording' })

    fireEvent.pointerDown(mic)
    await waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(1), { timeout: 3000 })
    fireEvent.pointerUp(mic)

    expect(screen.getByText('pages.aiAssistant.voiceMessageRecording')).toBeInTheDocument()

    const recorder = MockMediaRecorder.instances[0]
    act(() => {
      recorder.ondataavailable?.({ data: new Blob(['opus-bytes'], { type: 'audio/webm' }) })
    })

    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.voiceMessageSend' }))

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '',
        attachments: [{ type: 'audio', mime: 'audio/webm', data_b64: btoa('opus-bytes') }],
      })
    )
    // The feed shows an audio player bubble for the sent voice message.
    expect(document.querySelector('audio')).not.toBeNull()
    expect(screen.queryByText('pages.aiAssistant.voiceMessageRecording')).not.toBeInTheDocument()
  })

  it('cancelling the recording discards it without sending', async () => {
    renderPage()
    const mic = screen.getByRole('button', { name: 'pages.aiAssistant.voiceStartRecording' })

    fireEvent.pointerDown(mic)
    await waitFor(() => expect(MockMediaRecorder.instances).toHaveLength(1), { timeout: 3000 })
    fireEvent.pointerUp(mic)

    const recorder = MockMediaRecorder.instances[0]
    act(() => {
      recorder.ondataavailable?.({ data: new Blob(['opus-bytes'], { type: 'audio/webm' }) })
    })

    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.voiceMessageCancel' }))

    await waitFor(() =>
      expect(screen.queryByText('pages.aiAssistant.voiceMessageRecording')).not.toBeInTheDocument()
    )
    expect(mockedSendChatMessage).not.toHaveBeenCalled()
  })

  it('shows a TTS listen button under the assistant reply', async () => {
    renderPage()
    fireEvent.change(getTextarea(), { target: { value: 'привет' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await screen.findByText('Готово')
    expect(screen.getByRole('button', { name: 'pages.aiAssistant.ttsListen' })).toBeInTheDocument()
  })
})
