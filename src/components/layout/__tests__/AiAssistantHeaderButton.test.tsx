/**
 * AiAssistantHeaderButton — entitlement + kill-switch gating.
 *
 * Full DashboardLayout needs auth/websocket/search context to mount; this
 * exercises the exported button in isolation instead. The settings API is
 * mocked globally (src/test/mocks/aiAssistantSettings.ts); permissions come
 * from the real useAuthStore, mirroring AiAssistantBetaPage.mode.test.tsx.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AiAssistantHeaderButton } from '../DashboardLayout'
import { useAuthStore } from '@/stores/authStore'
import { PERMISSIONS } from '@/constants/permissions'
import { aiAssistantSettingsTestMocks } from '@/test/mocks/aiAssistantSettings'
import type { User } from '@/types/api'

const { mockGetAiAssistantSettings } = aiAssistantSettingsTestMocks

function renderButton() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return render(<AiAssistantHeaderButton />, { wrapper })
}

function setUser(permissions: string[]) {
  useAuthStore.setState({
    user: { id: '1', permissions } as unknown as User,
    isAuthenticated: true,
  })
}

describe('AiAssistantHeaderButton', () => {
  beforeEach(() => {
    mockGetAiAssistantSettings.mockReset()
  })

  it('stays hidden without the use_ai_assistant permission', () => {
    setUser([])
    mockGetAiAssistantSettings.mockResolvedValue({ assistant_enabled: true })
    renderButton()
    expect(screen.queryByLabelText('pages.aiAssistant.headerButtonAria')).not.toBeInTheDocument()
  })

  it('renders for an entitled user once the switch loads on', async () => {
    setUser([PERMISSIONS.AI_ASSISTANT.USE])
    mockGetAiAssistantSettings.mockResolvedValue({ assistant_enabled: true })
    renderButton()
    await waitFor(() =>
      expect(screen.getByLabelText('pages.aiAssistant.headerButtonAria')).toBeInTheDocument()
    )
  })

  it('hides for an entitled user once the global switch is off', async () => {
    setUser([PERMISSIONS.AI_ASSISTANT.USE])
    mockGetAiAssistantSettings.mockResolvedValue({ assistant_enabled: false })
    renderButton()
    await waitFor(() =>
      expect(screen.queryByLabelText('pages.aiAssistant.headerButtonAria')).not.toBeInTheDocument()
    )
  })

  it('stays hidden in a Spanish project, where the assistant does not speak the language', () => {
    useAuthStore.setState({
      user: {
        id: '1',
        permissions: [PERMISSIONS.AI_ASSISTANT.USE],
        projects: [{ id: '2', name: 'Madrid', country: 'ES', roles: [] }],
        active_project_id: '2',
      } as unknown as User,
      isAuthenticated: true,
    })
    mockGetAiAssistantSettings.mockResolvedValue({ assistant_enabled: true })
    renderButton()
    expect(screen.queryByLabelText('pages.aiAssistant.headerButtonAria')).not.toBeInTheDocument()
  })

  it('fails open (stays visible) while the settings request is pending', () => {
    setUser([PERMISSIONS.AI_ASSISTANT.USE])
    mockGetAiAssistantSettings.mockReturnValue(new Promise(() => {}))
    renderButton()
    expect(screen.getByLabelText('pages.aiAssistant.headerButtonAria')).toBeInTheDocument()
  })
})
