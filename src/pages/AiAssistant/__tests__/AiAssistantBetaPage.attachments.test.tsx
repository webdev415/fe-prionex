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
import { AssistantChatStreamError, sendChatMessage } from '@/features/aiAssistant/api'
import {
  MAX_ATTACHMENTS,
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_BYTES,
} from '@/features/aiAssistant/attachments'

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

function makeFile(name: string, type: string, content = `${name}-bytes`): File {
  return new File([content], name, { type })
}

function pasteFiles(files: File[]) {
  fireEvent.paste(getTextarea(), {
    clipboardData: {
      items: files.map((file) => ({ kind: 'file', getAsFile: () => file })),
    },
  })
}

function dropFiles(files: File[]) {
  const dropZone = screen.getByTestId('pending-attachments-dropzone')
  fireEvent.drop(dropZone, { dataTransfer: { files, types: ['Files'] } })
}

function pickFiles(files: File[]) {
  const input = screen.getByTestId('attach-image-input') as HTMLInputElement
  fireEvent.change(input, { target: { files } })
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
    await waitFor(() => expect(chips.querySelectorAll('img')).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.attachImageRemove' }))
    expect(screen.queryByTestId('pending-attachments')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
  })

  it(`caps attachments at ${MAX_ATTACHMENTS} and warns about the overflow`, async () => {
    renderPage()
    pasteFiles(
      Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, index) => makeImageFile(`${index}.png`))
    )

    const chips = await screen.findByTestId('pending-attachments')
    await waitFor(() => expect(chips.querySelectorAll('img')).toHaveLength(MAX_ATTACHMENTS))
    expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachTooMany')
  })

  it('rejects unsupported types and oversized images', async () => {
    renderPage()
    pasteFiles([makeImageFile('a.gif', 'image/gif')])
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachUnsupported')
    )

    const big = makeImageFile('big.png')
    Object.defineProperty(big, 'size', { value: MAX_IMAGE_BYTES + 1 })
    pasteFiles([big])
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachTooLarge')
    )
    expect(screen.queryByTestId('pending-attachments')).not.toBeInTheDocument()
  })

  it('sends pasted images with the text and renders the thumbnail in the feed', async () => {
    renderPage()
    pasteFiles([makeImageFile()])
    await screen.findByTestId('pending-attachment-image')

    fireEvent.change(getTextarea(), { target: { value: 'что на скрине?' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'что на скрине?',
        attachments: [{ type: 'image', mime: 'image/png', data_b64: btoa('png-bytes') }],
      }),
      expect.anything()
    )
    // The composer chips are consumed; the bubble shows the thumbnail.
    expect(screen.queryByTestId('pending-attachments')).not.toBeInTheDocument()
    expect(await screen.findByAltText('pages.aiAssistant.attachedImageAlt')).toBeInTheDocument()
  })

  it('accepts a PDF picked from the file dialog and shows name, size and type', async () => {
    renderPage()
    const pdf = makeFile('borg.pdf', 'application/pdf')
    Object.defineProperty(pdf, 'size', { value: 2048 })
    pickFiles([pdf])

    const card = await screen.findByTestId('pending-attachment-document')
    expect(card).toHaveTextContent('borg.pdf')
    expect(card).toHaveTextContent('2 KB')
    // The image preview must not be used for documents.
    expect(screen.queryByTestId('pending-attachment-image')).not.toBeInTheDocument()
  })

  it('accepts a dropped CSV whose type the OS did not report', async () => {
    renderPage()
    dropFiles([makeFile('rows.csv', '')])

    const card = await screen.findByTestId('pending-attachment-document')
    expect(card).toHaveTextContent('rows.csv')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('rejects an executable and an archive', async () => {
    renderPage()
    pickFiles([makeFile('setup.exe', 'application/x-msdownload')])
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachUnsupported')
    )

    vi.mocked(toast.error).mockClear()
    dropFiles([makeFile('pack.zip', 'application/zip')])
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachUnsupported')
    )
    expect(screen.queryByTestId('pending-attachments')).not.toBeInTheDocument()
  })

  it('rejects a document above the size limit before sending it', async () => {
    renderPage()
    const huge = makeFile('huge.xlsx', 'application/vnd.ms-excel')
    Object.defineProperty(huge, 'size', { value: MAX_DOCUMENT_BYTES + 1 })
    pickFiles([huge])

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachTooLarge')
    )
    expect(screen.queryByTestId('pending-attachments')).not.toBeInTheDocument()
    expect(mockedSendChatMessage).not.toHaveBeenCalled()
  })

  it('sends a document with the text and keeps the card in the feed', async () => {
    renderPage()
    pickFiles([makeFile('borg.pdf', 'application/pdf', 'pdf-bytes')])
    await screen.findByTestId('pending-attachment-document')

    fireEvent.change(getTextarea(), { target: { value: 'розбери документ' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'розбери документ',
        attachments: [
          {
            type: 'document',
            mime: 'application/pdf',
            data_b64: btoa('pdf-bytes'),
            filename: 'borg.pdf',
          },
        ],
      }),
      expect.anything()
    )
    expect(screen.queryByTestId('pending-attachments')).not.toBeInTheDocument()
    const bubbleCard = await screen.findByTestId('message-attachment-document')
    expect(bubbleCard).toHaveTextContent('borg.pdf')
  })

  it('shows the server wording when the backend rejects the attachment', async () => {
    mockedSendChatMessage.mockRejectedValueOnce(
      new AssistantChatStreamError({
        status: 413,
        message: 'документ 62914560 байт перевищує ліміт 52428800 байт (50MB)',
      })
    )
    renderPage()
    pickFiles([makeFile('borg.pdf', 'application/pdf')])
    await screen.findByTestId('pending-attachment-document')

    fireEvent.change(getTextarea(), { target: { value: 'розбери документ' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'документ 62914560 байт перевищує ліміт 52428800 байт (50MB)'
      )
    )
    expect(
      await screen.findByText('документ 62914560 байт перевищує ліміт 52428800 байт (50MB)')
    ).toBeInTheDocument()
    // The typed text comes back so the operator can retry without re-typing.
    await waitFor(() => expect(getTextarea().value).toBe('розбери документ'))
  })

  it('falls back to its own wording when a 413 carries no readable body', async () => {
    mockedSendChatMessage.mockRejectedValueOnce(new AssistantChatStreamError({ status: 413 }))
    renderPage()
    fireEvent.change(getTextarea(), { target: { value: 'привіт' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.attachRejectedTooLarge')
    )
  })

  it('does not send an image without text and explains why', async () => {
    renderPage()
    pasteFiles([makeImageFile()])
    await screen.findByTestId('pending-attachment-image')

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
      }),
      expect.anything()
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
