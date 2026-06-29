import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

import { sendChatMessage } from '@/features/aiAssistant/api'

const mockedSendChatMessage = vi.mocked(sendChatMessage)

// Radix DropdownMenu relies on pointer-capture APIs jsdom doesn't implement.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
    Element.prototype.setPointerCapture = vi.fn()
    Element.prototype.releasePointerCapture = vi.fn()
  }
  Element.prototype.scrollIntoView = vi.fn()
})

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

describe('AiAssistantBetaPage composer "+" hub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    URL.createObjectURL = vi.fn(() => `blob:mock-${Math.random().toString(36).slice(2, 8)}`)
    URL.revokeObjectURL = vi.fn()
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

  it('opens the hub and lists attach, CRM actions, deep research and context items', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByTestId('composer-hub-trigger'))

    const menu = await screen.findByTestId('composer-hub-menu')
    // File picker entry.
    expect(within(menu).getByTestId('hub-attach')).toBeInTheDocument()
    // Deep-research toggle.
    expect(within(menu).getByTestId('hub-deep-research')).toBeInTheDocument()
    // All four CRM quick-actions.
    expect(within(menu).getByTestId('hub-action-quickClientData')).toBeInTheDocument()
    expect(within(menu).getByTestId('hub-action-quickDebt')).toBeInTheDocument()
    expect(within(menu).getByTestId('hub-action-quickReport')).toBeInTheDocument()
    expect(within(menu).getByTestId('hub-action-quickEmployee')).toBeInTheDocument()
    // Client/portfolio context choices.
    expect(within(menu).getByTestId('hub-context-all')).toBeInTheDocument()
    expect(within(menu).getByTestId('hub-context-my')).toBeInTheDocument()
  })

  it('opens the file picker from the hub attach item', async () => {
    const user = userEvent.setup()
    renderPage()

    const fileInput = screen.getByTestId('attach-image-input') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    await user.click(screen.getByTestId('composer-hub-trigger'))
    await user.click(await screen.findByTestId('hub-attach'))

    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('runs a CRM quick-action from the hub through the same submit handler', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByTestId('composer-hub-trigger'))
    await user.click(await screen.findByTestId('hub-action-quickClientData'))

    // The quick-action prompt is sent as a normal chat message.
    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'pages.aiAssistant.quickPromptClientData' }),
      expect.anything()
    )
  })

  it('sends deep_research:true after enabling deep analysis in the hub', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByTestId('composer-hub-trigger'))
    await user.click(await screen.findByTestId('hub-deep-research'))
    // Toggling does not close the menu; dismiss it before typing.
    await user.keyboard('{Escape}')

    fireEvent.change(getTextarea(), { target: { value: 'разберись детально' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'разберись детально', deep_research: true }),
      expect.anything()
    )
    // The flag persisted to the settings store.
    expect(useAiAssistantStore.getState().settingsFor('7')?.deepResearch).toBe(true)
  })

  it('omits deep_research when the toggle stays off (default)', async () => {
    renderPage()

    fireEvent.change(getTextarea(), { target: { value: 'обычный вопрос' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    const payload = mockedSendChatMessage.mock.calls[0][0]
    expect(payload.deep_research).toBeUndefined()
  })

  it('sets the client/portfolio context from the hub', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByTestId('composer-hub-trigger'))
    await user.click(await screen.findByTestId('hub-context-my'))

    // Re-open: the chosen scope is reflected by a checkmark on "my clients".
    await user.click(screen.getByTestId('composer-hub-trigger'))
    const myItem = await screen.findByTestId('hub-context-my')
    expect(myItem.querySelector('svg')).not.toBeNull()
  })
})

describe('AiAssistantBetaPage mode dropdown (right of the composer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
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

  it('changes the mode and persists it to the settings store', () => {
    renderPage()

    fireEvent.click(screen.getByTestId('assistant-mode-trigger'))
    const menu = screen.getByTestId('assistant-mode-menu')
    fireEvent.click(within(menu).getByText('pages.aiAssistant.modeThinkingShort'))

    expect(useAiAssistantStore.getState().settingsFor('7')?.mode).toBe('thinking')
    // The menu closes after picking, and the trigger reflects the new mode.
    expect(screen.queryByTestId('assistant-mode-menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('assistant-mode-trigger')).toHaveTextContent(
      'pages.aiAssistant.modeThinkingShort'
    )
  })

  it('sends the chosen mode in the chat payload', async () => {
    renderPage()

    fireEvent.click(screen.getByTestId('assistant-mode-trigger'))
    fireEvent.click(
      within(screen.getByTestId('assistant-mode-menu')).getByText(
        'pages.aiAssistant.modeThinkingShort'
      )
    )

    fireEvent.change(getTextarea(), { target: { value: 'думай' } })
    fireEvent.keyDown(getTextarea(), { key: 'Enter' })

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    expect(mockedSendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'thinking' }),
      expect.anything()
    )
  })
})

describe('AiAssistantBetaPage voice listening settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  function openSettings() {
    fireEvent.click(screen.getByRole('button', { name: 'pages.aiAssistant.settings' }))
  }

  it('saves the chosen silence timeout to the store (1.5s)', () => {
    renderPage()
    openSettings()

    // The i18n mock echoes the key for every "voiceSeconds" option, so target
    // by position inside the silence-timeout group: index 0 == 1.5s.
    const silenceGroup = screen.getByRole('group', {
      name: 'pages.aiAssistant.voiceSilenceTimeout',
    })
    fireEvent.click(within(silenceGroup).getAllByRole('button')[0])

    // Default was 2; the first option is 1.5.
    expect(useAiAssistantStore.getState().settingsFor('7')?.voiceSilenceTimeoutSec).toBe(1.5)
  })

  it('persists a chosen max recording length (60s)', () => {
    renderPage()
    openSettings()

    const maxGroup = screen.getByRole('group', { name: 'pages.aiAssistant.voiceMaxDuration' })
    // Options are 30 / 60 / 120s by position: index 1 == 60s.
    fireEvent.click(within(maxGroup).getAllByRole('button')[1])

    expect(useAiAssistantStore.getState().settingsFor('7')?.voiceMaxDurationSec).toBe(60)
  })
})
