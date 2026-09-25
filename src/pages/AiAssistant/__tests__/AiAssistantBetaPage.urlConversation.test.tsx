/**
 * Deep-link на диалог: ?conversation=<id> открывает диалог по ссылке и
 * адресная строка всегда отражает активный диалог (см. conversationUrl.ts).
 * Здесь же — маркер ?conversation=new: явный «чистый лист» в адресе.
 * Харнес — как в AiAssistantBetaPage.hydration.test.tsx.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { DEFAULT_ASSISTANT_SETTINGS, useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import type {
  AssistantConversationDetail,
  AssistantConversationSummary,
} from '@/features/aiAssistant/api'

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

import { getConversation, getConversations, sendChatMessage } from '@/features/aiAssistant/api'

const mockedGetConversation = vi.mocked(getConversation)
const mockedGetConversations = vi.mocked(getConversations)
const mockedSendChatMessage = vi.mocked(sendChatMessage)

const conversationSummary = (id: number): AssistantConversationSummary => ({
  id,
  user_id: 7,
  project_id: 1,
  channel: 'web',
  status: 'active',
  title: null,
  pinned: false,
  archived: false,
  created_at: '2026-08-31T10:00:00Z',
  last_message_at: '2026-08-31T10:01:00Z',
})

const conversationDetail = (id: number): AssistantConversationDetail => ({
  id,
  user_id: 7,
  project_id: 1,
  channel: 'web',
  status: 'active',
  title: null,
  pinned: false,
  archived: false,
  created_at: '2026-08-31T10:00:00Z',
  last_message_at: '2026-08-31T10:01:00Z',
  messages: [
    {
      id: 201,
      conversation_id: id,
      role: 'user',
      content: 'Скільки обіцянок на сьогодні?',
      model: null,
      latency_ms: null,
      tokens: null,
      created_at: '2026-08-31T10:00:00Z',
    },
    {
      id: 202,
      conversation_id: id,
      role: 'assistant',
      content: 'На сьогодні 375 домовленостей.',
      model: 'rosh',
      latency_ms: 900,
      tokens: 50,
      created_at: '2026-08-31T10:01:00Z',
    },
  ],
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

describe('AiAssistantBetaPage: deep-link ?conversation=', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    window.history.replaceState(null, '', '/dashboard/ai-assistant')
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  it('открывает диалог из URL без сохранённого указателя', async () => {
    window.history.replaceState(null, '', '/dashboard/ai-assistant?conversation=42')
    mockedGetConversation.mockResolvedValue(conversationDetail(42))

    renderPage()

    expect(await screen.findByText('На сьогодні 375 домовленостей.')).toBeInTheDocument()
    expect(mockedGetConversation).toHaveBeenCalledWith(42)
  })

  it('URL перекрывает сохранённый указатель и открывает диалог даже при выключенном «помнить контекст»', async () => {
    window.history.replaceState(null, '', '/dashboard/ai-assistant?conversation=42')
    useAiAssistantStore.getState().setActiveConversation('7', 55)
    useAiAssistantStore.getState().saveSettings('7', {
      ...DEFAULT_ASSISTANT_SETTINGS,
      rememberConversationContext: false,
    })
    mockedGetConversation.mockResolvedValue(conversationDetail(42))

    renderPage()

    await waitFor(() => {
      expect(mockedGetConversation).toHaveBeenCalledWith(42)
    })
    expect(mockedGetConversation).not.toHaveBeenCalledWith(55)
  })

  it('после гидратации сохранённого диалога id появляется в адресе', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(conversationDetail(42))

    renderPage()

    await screen.findByText('На сьогодні 375 домовленостей.')
    await waitFor(() => {
      expect(window.location.search).toContain('conversation=42')
    })
  })

  it('«Новий чат» ставит в адрес маркер нового диалога', async () => {
    useAiAssistantStore.getState().setActiveConversation('7', 42)
    mockedGetConversation.mockResolvedValue(conversationDetail(42))

    renderPage()
    await screen.findByText('На сьогодні 375 домовленостей.')
    await waitFor(() => expect(window.location.search).toContain('conversation=42'))

    // i18n в тестах отдаёт сырые ключи — целимся так же, как sidebar-тест.
    const newChatButtons = screen.getAllByText('pages.aiAssistant.historyNewChat')
    await userEvent.click(newChatButtons[0])

    // Маркер, а не пустой адрес: нажатие обязано быть видно в адресной строке
    // и при входе без параметра.
    await waitFor(() => {
      expect(window.location.search).toContain('conversation=new')
    })
    expect(useAiAssistantStore.getState().conversationIdFor('7')).toBeNull()
  })

  it('мусорный параметр игнорируется — страница открывается как обычно', async () => {
    window.history.replaceState(null, '', '/dashboard/ai-assistant?conversation=abc')

    renderPage()

    await waitFor(() => {
      expect(mockedGetConversation).not.toHaveBeenCalled()
    })
  })
})

describe('AiAssistantBetaPage: маркер ?conversation=new', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    window.history.replaceState(null, '', '/dashboard/ai-assistant')
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
    mockedGetConversations.mockResolvedValue([])
    mockedGetConversation.mockResolvedValue(conversationDetail(55))
  })

  it('не гидратирует сохранённый диалог даже при включённом «помнить контекст»', async () => {
    window.history.replaceState(null, '', '/dashboard/ai-assistant?conversation=new')
    useAiAssistantStore.getState().setActiveConversation('7', 55)
    useAiAssistantStore.getState().saveSettings('7', {
      ...DEFAULT_ASSISTANT_SETTINGS,
      rememberConversationContext: true,
    })

    renderPage()

    // Указатель гасится, запроса диалога нет. Ждём не «отсутствия события», а
    // наблюдаемого следствия — снятого указателя; запрос к тому моменту уже
    // ушёл бы (он стартует в том же коммите, что и монтирование).
    await waitFor(() => {
      expect(useAiAssistantStore.getState().conversationIdFor('7')).toBeNull()
    })
    expect(mockedGetConversation).not.toHaveBeenCalled()
    // Маркер держится в адресе — до первой отправки диалога ещё нет.
    expect(window.location.search).toContain('conversation=new')
  })

  it('после первой отправки адрес получает id созданного диалога', async () => {
    window.history.replaceState(null, '', '/dashboard/ai-assistant?conversation=new')
    mockedSendChatMessage.mockResolvedValue({
      conversation_id: 101,
      message_id: 5,
      response: 'Готово',
      coverage_flag: null,
      tool_calls: [],
    })

    renderPage()

    const textarea = screen.getByLabelText(
      'pages.aiAssistant.inputPlaceholder'
    ) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'привіт' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => expect(mockedSendChatMessage).toHaveBeenCalledTimes(1))
    await waitFor(() => {
      expect(window.location.search).toContain('conversation=101')
    })
    expect(window.location.search).not.toContain('conversation=new')
  })

  it('не мешает выбрать диалог в истории в том же монтировании', async () => {
    window.history.replaceState(null, '', '/dashboard/ai-assistant?conversation=new')
    useAiAssistantStore.getState().setActiveConversation('7', 55)
    mockedGetConversations.mockResolvedValue([conversationSummary(42)])
    mockedGetConversation.mockResolvedValue(conversationDetail(42))

    renderPage()

    // Гейт маркера одноразовый: он гасит стартовую гидратацию, но клик по
    // истории после этого обязан открывать диалог как обычно.
    fireEvent.click(await screen.findByTestId('conversation-item-42'))

    expect(await screen.findByText('На сьогодні 375 домовленостей.')).toBeInTheDocument()
    expect(mockedGetConversation).toHaveBeenCalledWith(42)
    await waitFor(() => {
      expect(window.location.search).toContain('conversation=42')
    })
  })
})
