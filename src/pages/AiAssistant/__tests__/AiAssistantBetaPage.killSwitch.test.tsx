/**
 * AiAssistantBetaPage — global kill-switch banner.
 *
 * When an admin flips assistant_enabled off (AssistantSettingsSection), the
 * page must swap the chat for a disabled banner instead of rendering the
 * composer. The settings API is mocked globally in
 * src/test/mocks/aiAssistantSettings.ts (shared across the suite).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AiAssistantBetaPage } from '../AiAssistantBetaPage'
import { useAiAssistantStore } from '@/stores/aiAssistantStore'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'
import { aiAssistantSettingsTestMocks } from '@/test/mocks/aiAssistantSettings'

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

const { mockGetAiAssistantSettings } = aiAssistantSettingsTestMocks

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<AiAssistantBetaPage />, { wrapper })
}

describe('AiAssistantBetaPage kill switch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAiAssistantSettings.mockReset()
    localStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
    useAiAssistantStore.setState({ userId: null, conversationId: null, settings: null })
    useAuthStore.setState({ user: { id: '7' } as unknown as User, isAuthenticated: true })
  })

  it('renders the disabled banner instead of the composer when assistant_enabled is false', async () => {
    mockGetAiAssistantSettings.mockResolvedValue({ assistant_enabled: false })
    renderPage()

    expect(await screen.findByText('pages.aiSettings.disabledBanner')).toBeInTheDocument()
    expect(screen.queryByLabelText('pages.aiAssistant.inputPlaceholder')).not.toBeInTheDocument()
  })

  it('renders the normal composer when the switch is on', async () => {
    mockGetAiAssistantSettings.mockResolvedValue({ assistant_enabled: true })
    renderPage()

    expect(await screen.findByLabelText('pages.aiAssistant.inputPlaceholder')).toBeInTheDocument()
    expect(screen.queryByText('pages.aiSettings.disabledBanner')).not.toBeInTheDocument()
  })
})
