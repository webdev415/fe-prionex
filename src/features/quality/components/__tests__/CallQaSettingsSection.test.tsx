/**
 * CallQaSettingsSection tests — the admin «AI call analysis» toggle card.
 *
 * The API layer is mocked, the hooks are real (the click must reach the PUT
 * through the mutation). PermissionGuard is driven via the @/hooks mock; the
 * i18n mock in src/test/setup.ts returns keys, so assertions use keys.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CallQaSettingsSection } from '../CallQaSettingsSection'
import { callQaSettingsTestMocks } from '@/test/mocks/callQaSettings'
import { useHasPermission } from '@/hooks'

const { mockGetCallQaSettings, mockUpdateCallQaSettings, callQaAuthState } = callQaSettingsTestMocks

vi.mock('@/hooks', () => ({
  useHasPermission: vi.fn(),
  useHasAnyPermission: vi.fn(() => false),
  useHasAllPermissions: vi.fn(() => false),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector(callQaAuthState),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mockUseHasPermission = vi.mocked(useHasPermission)

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CallQaSettingsSection />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockGetCallQaSettings.mockReset()
  mockUpdateCallQaSettings.mockReset()
  mockUseHasPermission.mockReset()
  callQaAuthState.isAuthenticated = true
  mockUseHasPermission.mockReturnValue(true)
  mockGetCallQaSettings.mockResolvedValue({ transcripts_enabled: false })
})

describe('CallQaSettingsSection', () => {
  it('stays hidden without the manage_call_qa permission', () => {
    mockUseHasPermission.mockReturnValue(false)
    renderSection()
    expect(screen.queryByTestId('call-qa-settings-section')).not.toBeInTheDocument()
  })

  it('renders the card with the loaded switch state under manage_call_qa', async () => {
    mockGetCallQaSettings.mockResolvedValue({ transcripts_enabled: true })
    renderSection()

    expect(screen.getByText('pages.callQaSettings.title')).toBeInTheDocument()
    expect(screen.getByText('pages.callQaSettings.description')).toBeInTheDocument()
    // Switch stays disabled until the GET lands — same wait pattern as the click tests.
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled(), { timeout: 5000 })
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('PUTs the flipped value on click and toasts success', async () => {
    mockUpdateCallQaSettings.mockResolvedValue({ transcripts_enabled: true })
    renderSection()

    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled(), { timeout: 5000 })
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() =>
      expect(mockUpdateCallQaSettings).toHaveBeenCalledWith({ transcripts_enabled: true })
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('pages.callQaSettings.toastEnabled')
    )
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('toasts an error and keeps the state when the PUT fails', async () => {
    mockUpdateCallQaSettings.mockRejectedValue(new Error('403'))
    renderSection()

    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled(), { timeout: 5000 })
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('pages.callQaSettings.toastError'))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })
})
