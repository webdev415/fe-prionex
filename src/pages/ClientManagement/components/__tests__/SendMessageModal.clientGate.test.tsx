import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SendMessageModal } from '../SendMessageModal'

const { useClientMock } = vi.hoisted(() => ({ useClientMock: vi.fn() }))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
      i18n: { language: 'en' },
    }),
  }
})

vi.mock('@/features/clients/hooks/useClients', () => ({
  useClient: (...args: unknown[]) => useClientMock(...args),
}))

vi.mock('@/features/messaging', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/messaging')>()
  const integrations = [
    {
      id: 1,
      project_id: 1,
      service: 'turbosms',
      supported_channels: ['sms'],
      enabled_channels: ['sms'],
      status: 'configured',
      credentials_preview: {},
      last_tested_at: null,
      last_test_result: { ok: true },
      created_at: '2026-09-01T00:00:00Z',
      updated_at: null,
    },
  ]
  const integrationsResult = { data: integrations, isLoading: false }
  const draftsResult = { data: [], isLoading: false }
  const quotaResult = { data: undefined }
  const sendResult = { mutateAsync: vi.fn(), isPending: false }
  return {
    ...actual,
    isMessagingIntegrationUsable: () => true,
    useMessagingIntegrations: () => integrationsResult,
    useMessagingDrafts: () => draftsResult,
    useDestinationQuota: () => quotaResult,
    useCanReadMessagingDrafts: () => true,
    useSendMessage: () => sendResult,
    MessagingVariablesPalette: () => null,
  }
})

vi.mock('@/hooks/usePermissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/usePermissions')>()
  return { ...actual, useHasPermission: () => true }
})

vi.mock('@/stores/authStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/authStore')>()
  const state = {
    user: { username: 'operator', active_project_id: '1', timezone: 'Europe/Kyiv' },
  }
  return { ...actual, useAuthStore: () => state }
})

vi.mock('@/features/auth/api/authApi', () => ({
  authApi: { me: () => new Promise(() => {}) },
}))

const phones = ['380009262315']
const noLoans: Array<{ id: number; loanNumber: string; totalToRepay: number }> = []

function openAndType() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SendMessageModal
        open
        onClose={() => {}}
        clientId={42}
        clientName="Moroz Dmytro Ivanovych"
        phones={phones}
        loans={noLoans}
      />
    </QueryClientProvider>
  )
  fireEvent.change(screen.getByLabelText('Message body'), { target: { value: 'Hello' } })
  return screen.getByRole('button', { name: 'Send message' })
}

describe('sending a message needs the client to be loaded', () => {
  beforeEach(() => {
    useClientMock.mockReset()
  })

  it('blocks sending and says why when the client failed to load', () => {
    useClientMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    expect(openAndType()).toBeDisabled()
    expect(screen.getByText('pages.clients.modals.sendSMS.clientLoadFailed')).toBeInTheDocument()
  })

  it('blocks sending while the client is still on its way', () => {
    useClientMock.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    expect(openAndType()).toBeDisabled()
    expect(screen.queryByText('pages.clients.modals.sendSMS.clientLoadFailed')).toBeNull()
  })

  it('allows sending once the client is loaded', () => {
    useClientMock.mockReturnValue({
      data: { max_promise_to_pay_date: null, debts: [] },
      isLoading: false,
      isError: false,
    })

    expect(openAndType()).toBeEnabled()
  })
})
