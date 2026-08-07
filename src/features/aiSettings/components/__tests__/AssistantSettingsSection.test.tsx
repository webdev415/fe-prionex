/**
 * AssistantSettingsSection tests — the admin assistant kill-switch card.
 *
 * The API layer is mocked, the hooks are real (the click must reach the PUT
 * through the mutation). PermissionGuard is driven via the @/hooks mock; the
 * i18n mock in src/test/setup.ts returns keys, so assertions use keys.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AssistantSettingsSection } from '../AssistantSettingsSection'
import { aiAssistantSettingsTestMocks } from '@/test/mocks/aiAssistantSettings'
import { useHasPermission } from '@/hooks'

const { mockGetAiAssistantSettings, mockUpdateAiAssistantSettings, aiAssistantSettingsAuthState } =
  aiAssistantSettingsTestMocks

vi.mock('@/hooks', () => ({
  useHasPermission: vi.fn(),
  useHasAnyPermission: vi.fn(() => false),
  useHasAllPermissions: vi.fn(() => false),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector(aiAssistantSettingsAuthState),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockUseHasPermission = vi.mocked(useHasPermission)

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantSettingsSection />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockGetAiAssistantSettings.mockReset()
  mockUpdateAiAssistantSettings.mockReset()
  mockUseHasPermission.mockReset()
  aiAssistantSettingsAuthState.isAuthenticated = true
  mockUseHasPermission.mockReturnValue(true)
  mockGetAiAssistantSettings.mockResolvedValue({ assistant_enabled: true })
})

describe('AssistantSettingsSection', () => {
  it('stays hidden without the manage_ai_settings permission', () => {
    mockUseHasPermission.mockReturnValue(false)
    renderSection()
    expect(screen.queryByTestId('assistant-settings-section')).not.toBeInTheDocument()
  })

  it('renders the card with the loaded switch state under manage_ai_settings', async () => {
    mockGetAiAssistantSettings.mockResolvedValue({ assistant_enabled: true })
    renderSection()

    expect(screen.getByText('pages.aiSettings.assistantToggleTitle')).toBeInTheDocument()
    expect(screen.getByText('pages.aiSettings.assistantToggleDescription')).toBeInTheDocument()
    // Switch stays disabled until the GET lands — same wait pattern as the click tests.
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled(), { timeout: 5000 })
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('PUTs the flipped value on click and toasts success', async () => {
    mockUpdateAiAssistantSettings.mockResolvedValue({ assistant_enabled: false })
    renderSection()

    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled(), { timeout: 5000 })
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() =>
      expect(mockUpdateAiAssistantSettings).toHaveBeenCalledWith({ assistant_enabled: false })
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('pages.aiSettings.toastDisabled')
    )
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('toasts an error and keeps the state when the PUT fails', async () => {
    mockUpdateAiAssistantSettings.mockRejectedValue(new Error('403'))
    renderSection()

    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled(), { timeout: 5000 })
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('pages.aiSettings.toastError'))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })
})
