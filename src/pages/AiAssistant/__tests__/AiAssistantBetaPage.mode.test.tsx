import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AxiosError } from 'axios'
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

/** Pick "thinking" from the composer mode dropdown (no longer in settings). */
function selectThinkingMode() {
  fireEvent.click(screen.getByTestId('assistant-mode-trigger'))
  const menu = screen.getByTestId('assistant-mode-menu')
  fireEvent.click(within(menu).getByText('pages.aiAssistant.modeThinkingShort'))
}

describe('AiAssistantBetaPage response mode + attachment trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random().toString(36).slice(2, 8)}`)
    URL.revokeObjectURL = vi.fn()
    // Desktop layout so the settings popover renders inline.
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
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

  it('sends the default fast mode in the chat payload', async () => {
    renderPage()
    fireEvent.change(getTextarea(), { target: { value: 'привет' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    // The payload is arg 0; arg 1 carries the SSE stream callbacks.
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'fast' }),
      expect.anything()
    )
  })

  it('sends the selected thinking mode in the chat payload', async () => {
    renderPage()
    selectThinkingMode()

    fireEvent.change(getTextarea(), { target: { value: 'глубокий вопрос' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'thinking' }),
      expect.anything()
    )
  })

  it('rolls back to fast and warns when the thinking mode answers 503', async () => {
    const error = new AxiosError('unavailable')
    error.response = {
      status: 503,
      statusText: 'Service Unavailable',
      data: {},
      headers: {},
      config: {} as never,
    }
    mockedSendChatMessage.mockRejectedValueOnce(error)

    renderPage()
    selectThinkingMode()

    fireEvent.change(getTextarea(), { target: { value: 'глубокий вопрос' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('pages.aiAssistant.thinkingUnavailable')
    )

    // The toggle is back on fast: the next message carries mode: 'fast'.
    fireEvent.change(getTextarea(), { target: { value: 'ещё раз' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(2))
    expect(mockedSendChatMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'ещё раз', mode: 'fast' }),
      expect.anything()
    )
  })

  it('attaches an image picked through the paperclip button and sends it with the text', async () => {
    renderPage()
    const fileInput = screen.getByTestId('attach-image-input') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [makeImageFile()] } })

    // Wait for the encoded chip, not the container — the container also holds
    // the "preparing" placeholder, and sending then leaves the file behind.
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
  })
})
