import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTemplates = vi.hoisted(() => vi.fn(async () => ({ templates: [], total: 0 })))
const getSMSConfig = vi.hoisted(() => vi.fn(async () => ({})))

vi.mock('../api/smsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/smsApi')>()),
  getTemplates,
  getSMSConfig,
}))

const { useSMSTemplates, useSMSConfig } = await import('../hooks/useSMS')
const { useAuthStore } = await import('@/stores/authStore')

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function signIn(permissions: string[]) {
  useAuthStore.setState({
    user: { id: 1, username: 'u', permissions } as never,
  })
}

describe('the sms settings queries and the permission they need', () => {
  beforeEach(() => {
    getTemplates.mockClear()
    getSMSConfig.mockClear()
  })

  it('asks for neither when the reader holds neither permission', async () => {
    signIn(['view_clients'])

    renderHook(() => useSMSTemplates(), { wrapper })
    renderHook(() => useSMSConfig(), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(getTemplates).not.toHaveBeenCalled()
    expect(getSMSConfig).not.toHaveBeenCalled()
  })

  it('asks for both when the reader may send', async () => {
    signIn(['send_sms'])

    renderHook(() => useSMSTemplates(), { wrapper })
    renderHook(() => useSMSConfig(), { wrapper })

    await waitFor(() => expect(getTemplates).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(getSMSConfig).toHaveBeenCalledTimes(1))
  })

  it('managing settings is enough on its own', async () => {
    signIn(['manage_settings'])

    renderHook(() => useSMSTemplates(), { wrapper })

    await waitFor(() => expect(getTemplates).toHaveBeenCalledTimes(1))
  })
})
