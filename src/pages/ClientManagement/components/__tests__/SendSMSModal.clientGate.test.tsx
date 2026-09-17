import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SendSMSModal } from '../SendSMSModal'

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

vi.mock('@/features/sms', () => {
  const templates = { data: { templates: [] }, isLoading: false }
  const config = { data: { max_sms_per_recipient_per_day: 3 } }
  const send = { mutateAsync: vi.fn(), isPending: false }
  const history = { data: { total: 0 } }
  return {
    useSMSTemplates: () => templates,
    useSMSConfig: () => config,
    useSendSMS: () => send,
    useSMSHistory: () => history,
  }
})

vi.mock('@/stores/authStore', () => {
  const state = {
    user: { username: 'operator', active_project_id: '1', timezone: 'Europe/Kyiv' },
  }
  return { useAuthStore: () => state }
})

vi.mock('@/features/auth/api/authApi', () => ({
  authApi: { me: () => new Promise(() => {}) },
}))

function openAndType() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SendSMSModal
        open
        onClose={() => {}}
        clientId={42}
        clientName="Moroz Dmytro Ivanovych"
        phoneNumber="380009262315"
        loans={[]}
      />
    </QueryClientProvider>
  )
  fireEvent.change(
    screen.getByPlaceholderText('pages.clients.modals.sendSMS.typeYourMessageHere'),
    { target: { value: 'Hello' } }
  )
  return screen.getByRole('button', { name: 'pages.clients.modals.sendSMS.sendSMS' })
}

describe('sending an SMS needs the client to be loaded', () => {
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
